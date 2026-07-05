<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useQuasar } from 'quasar'
import type { InputFile } from '@/core/types'
import {
  isAbortError,
  listLogFiles,
  pickWorkingDirectory,
  supportsFileSystemAccess,
  verifyPermission,
} from '@/fs/access'
import {
  clearWorkingDirectory,
  loadWorkingDirectory,
  rememberWorkingDirectory,
} from '@/fs/handles'
import { useSessionStore } from '@/stores/session'

const $q = useQuasar()
const session = useSessionStore()

// ---------------------------------------------------------------------------
// Shared ingest — both implementations end up here.
// ---------------------------------------------------------------------------
async function ingest(files: File[]): Promise<void> {
  if (files.length === 0) {
    return
  }
  try {
    const inputs: InputFile[] = await Promise.all(
      files.map(async (f) => ({ name: f.name, text: await f.text() })),
    )
    session.setFiles(inputs)
    if (session.lines.length === 0) {
      $q.notify({
        type: 'negative',
        message: 'No chat lines found — is this an ESO ChatLog file?',
      })
    } else {
      $q.notify({
        type: 'positive',
        message: `Parsed ${session.lines.length.toLocaleString()} chat lines from ${files.length} file(s).`,
      })
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: `Could not read file: ${(err as Error).message}` })
  }
}

// ---------------------------------------------------------------------------
// Implementation 1: File System Access folder workflow (Chromium).
// The user grants persistent read/write access to their logs folder once;
// inputs are read from it and outputs are written straight back.
// ---------------------------------------------------------------------------
let dirHandle: FileSystemDirectoryHandle | null = null

const folderName = ref<string | null>(null)
const needsReconnect = ref(false)
const scanning = ref(false)
const folderFiles = shallowRef<FileSystemFileHandle[]>([])
const selectedNames = ref<string[]>([])

const fileOptions = computed(() => folderFiles.value.map((f) => f.name))

onMounted(async () => {
  if (!supportsFileSystemAccess) {
    return
  }
  try {
    const stored = await loadWorkingDirectory()
    if (!stored) {
      return
    }
    if ((await stored.queryPermission({ mode: 'readwrite' })) === 'granted') {
      // Persistent permission ("Allow on every visit") — reconnect silently.
      await adoptFolder(stored)
    } else {
      dirHandle = stored
      folderName.value = stored.name
      needsReconnect.value = true
    }
  } catch {
    // Stored handle unusable (folder moved/deleted); start fresh.
  }
})

async function adoptFolder(dir: FileSystemDirectoryHandle): Promise<void> {
  dirHandle = dir
  session.setWorkingDirectory(dir)
  folderName.value = dir.name
  needsReconnect.value = false
  await rescan()
}

async function rescan(): Promise<void> {
  if (!dirHandle) {
    return
  }
  scanning.value = true
  try {
    const files = await listLogFiles(dirHandle)
    folderFiles.value = files
    const names = files.map((f) => f.name)
    let selection = selectedNames.value.filter((n) => names.includes(n))
    if (selection.length === 0) {
      const chatLog = names.find((n) => n.toLowerCase() === 'chatlog.log')
      if (chatLog) {
        selection = [chatLog]
      } else if (names.length === 1) {
        selection = [names[0]!]
      }
    }
    selectedNames.value = selection
    if (files.length === 0) {
      $q.notify({
        type: 'warning',
        message: `No .log or .txt files found in \u201c${dirHandle.name}\u201d.`,
      })
    }
    await applySelection()
  } catch (err) {
    $q.notify({ type: 'negative', message: `Could not scan folder: ${(err as Error).message}` })
  } finally {
    scanning.value = false
  }
}

async function applySelection(): Promise<void> {
  const handles = folderFiles.value.filter((h) => selectedNames.value.includes(h.name))
  session.setLogHandles(handles)
  if (handles.length === 0) {
    session.setFiles([])
    return
  }
  try {
    const files = await Promise.all(handles.map((h) => h.getFile()))
    await ingest(files)
  } catch (err) {
    $q.notify({ type: 'negative', message: `Could not read file: ${(err as Error).message}` })
  }
}

function onSelectionChange(value: string[] | null): void {
  selectedNames.value = value ?? []
  void applySelection()
}

async function chooseFolder(): Promise<void> {
  try {
    const dir = await pickWorkingDirectory()
    await adoptFolder(dir)
    await rememberWorkingDirectory(dir)
  } catch (err) {
    if (!isAbortError(err)) {
      $q.notify({ type: 'negative', message: `Could not open folder: ${(err as Error).message}` })
    }
  }
}

async function reconnect(): Promise<void> {
  if (!dirHandle) {
    return
  }
  try {
    if (await verifyPermission(dirHandle, true)) {
      await adoptFolder(dirHandle)
    } else {
      $q.notify({ type: 'warning', message: 'Folder access was not granted.' })
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: `Could not reconnect: ${(err as Error).message}` })
  }
}

async function forgetFolder(): Promise<void> {
  dirHandle = null
  folderName.value = null
  needsReconnect.value = false
  folderFiles.value = []
  selectedNames.value = []
  session.setWorkingDirectory(null)
  session.setFiles([])
  await clearWorkingDirectory()
}

// ---------------------------------------------------------------------------
// Implementation 2: classic upload -> process -> download (all browsers).
// ---------------------------------------------------------------------------
const dragOver = ref(false)
const fileModel = ref<File[] | null>(null)

function onFileModel(value: File[] | File | null): void {
  if (value === null) {
    return
  }
  void ingest(Array.isArray(value) ? value : [value])
}

function onDrop(evt: DragEvent): void {
  dragOver.value = false
  const files = [...(evt.dataTransfer?.files ?? [])]
  void ingest(files)
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 2 — Chat log</div>
      <div class="text-caption text-grey">
        <template v-if="supportsFileSystemAccess">
          Grant access to the folder that holds your logs once — outputs are saved straight back
          to it. Everything is processed locally in your browser.
        </template>
        <template v-else>
          Upload a log below and download the result. Everything is processed locally in your
          browser.
        </template>
      </div>
    </q-card-section>

    <!-- Implementation 1: folder workflow (File System Access API). -->
    <q-card-section v-if="supportsFileSystemAccess" class="q-pt-none column q-gutter-sm">
      <div v-if="!folderName" class="row q-gutter-sm items-center">
        <q-btn
          color="primary"
          icon="folder"
          label="Choose your logs folder…"
          @click="chooseFolder"
        />
        <div class="text-caption text-grey">
          e.g. <code>Documents\Elder Scrolls Online\live\Logs</code>
        </div>
      </div>

      <q-banner v-else-if="needsReconnect" dense rounded class="bg-warning text-dark">
        Reconnect to your logs folder “{{ folderName }}” to continue.
        <template #action>
          <q-btn flat icon="history" label="Reconnect" @click="reconnect" />
          <q-btn flat icon="folder" label="Choose another…" @click="chooseFolder" />
          <q-btn flat icon="folder_off" label="Forget" @click="forgetFolder" />
        </template>
      </q-banner>

      <template v-else>
        <div class="row q-gutter-sm items-center">
          <q-chip icon="folder_open" color="primary" text-color="white">
            {{ folderName }}
          </q-chip>
          <q-btn
            flat
            dense
            icon="refresh"
            :loading="scanning"
            aria-label="Rescan folder"
            @click="rescan"
          >
            <q-tooltip>Rescan folder for log files</q-tooltip>
          </q-btn>
          <q-btn flat dense no-caps label="Change folder…" @click="chooseFolder" />
          <q-btn
            flat
            dense
            icon="folder_off"
            aria-label="Forget folder"
            @click="forgetFolder"
          >
            <q-tooltip>Forget this folder</q-tooltip>
          </q-btn>
        </div>

        <q-select
          :model-value="selectedNames"
          :options="fileOptions"
          multiple
          use-chips
          filled
          dense
          label="Log file(s) to process"
          hint="ChatLog.log is selected automatically when present. Files are re-read fresh on every Generate."
          style="max-width: 560px"
          @update:model-value="onSelectionChange"
        />
      </template>
    </q-card-section>

    <!-- Implementation 2: upload/download fallback. -->
    <q-card-section v-else class="q-pt-none column q-gutter-sm">
      <q-file
        :model-value="fileModel"
        multiple
        use-chips
        filled
        accept=".log,.txt,text/plain"
        label="Choose log file(s)"
        @update:model-value="onFileModel"
      >
        <template #prepend>
          <q-icon name="upload_file" />
        </template>
      </q-file>

      <div
        class="drop-zone rounded-borders text-center"
        :class="{ 'drop-zone--over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <q-icon name="download" size="28px" class="q-mr-sm" />
        …or drag and drop files here
      </div>
    </q-card-section>

    <q-card-section v-if="session.hasInput" class="q-pt-none">
      <q-banner dense rounded class="bg-positive text-white">
        Loaded {{ session.files.length }} file(s) —
        {{ session.lines.length.toLocaleString() }} chat lines across
        {{ session.channelSummaries.length }} channels.
      </q-banner>
    </q-card-section>
  </q-card>
</template>

<style scoped>
.drop-zone {
  border: 2px dashed var(--q-primary);
  opacity: 0.7;
  padding: 28px;
}
.drop-zone--over {
  opacity: 1;
  background: rgba(233, 84, 32, 0.1);
}
</style>
