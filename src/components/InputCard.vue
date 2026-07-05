<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import type { InputFile } from '@/core/types'
import {
  isAbortError,
  pickLogFiles,
  supportsFilePickers,
  verifyPermission,
} from '@/fs/access'
import { loadInputHandles, rememberInputHandles } from '@/fs/handles'
import { useSessionStore } from '@/stores/session'

const $q = useQuasar()
const session = useSessionStore()

const dragOver = ref(false)
const fileModel = ref<File[] | null>(null)
const hasStoredHandles = ref(false)

onMounted(async () => {
  if (supportsFilePickers) {
    try {
      const stored = await loadInputHandles()
      hasStoredHandles.value = (stored?.length ?? 0) > 0
    } catch {
      hasStoredHandles.value = false
    }
  }
})

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

async function openWithFsAccess(): Promise<void> {
  try {
    const handles = await pickLogFiles()
    await rememberInputHandles(handles)
    hasStoredHandles.value = true
    const files = await Promise.all(handles.map((h) => h.getFile()))
    await ingest(files)
  } catch (err) {
    if (!isAbortError(err)) {
      $q.notify({ type: 'negative', message: `Could not open files: ${(err as Error).message}` })
    }
  }
}

async function reopenLast(): Promise<void> {
  try {
    const handles = await loadInputHandles()
    if (!handles || handles.length === 0) {
      hasStoredHandles.value = false
      return
    }
    for (const handle of handles) {
      if (!(await verifyPermission(handle, false))) {
        $q.notify({ type: 'warning', message: 'Permission to re-read the log was not granted.' })
        return
      }
    }
    const files = await Promise.all(handles.map((h) => h.getFile()))
    await ingest(files)
  } catch (err) {
    $q.notify({ type: 'negative', message: `Could not reopen log: ${(err as Error).message}` })
  }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Step 1 — Load chat logs</div>
      <div class="text-caption text-grey">
        Files are processed entirely in your browser.
      </div>
    </q-card-section>

    <q-card-section class="q-pt-none column q-gutter-sm">
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

      <div v-if="supportsFilePickers" class="row q-gutter-sm">
        <q-btn
          outline
          color="primary"
          icon="folder_open"
          label="Open with file access…"
          @click="openWithFsAccess"
        />
        <q-btn
          v-if="hasStoredHandles"
          outline
          color="secondary"
          icon="history"
          label="Reopen last log"
          @click="reopenLast"
        />
      </div>

      <q-banner v-if="session.hasInput" dense rounded class="bg-positive text-white">
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
