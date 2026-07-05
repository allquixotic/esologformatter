<script setup lang="ts">
import type { QTableColumn } from 'quasar'
import { ALL_CHANNEL_NAMES } from '@/core/channels'
import { useSessionStore, type ChannelSummary } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

const session = useSessionStore()
const settings = useSettingsStore()

const columns: QTableColumn<ChannelSummary>[] = [
  { name: 'enabled', label: 'Include?', field: 'channel', align: 'center' },
  { name: 'channel', label: 'Channel', field: 'channel', align: 'left' },
  { name: 'name', label: 'Display name', field: 'baseName', align: 'left' },
  { name: 'alias', label: 'Alias / abbrev.', field: 'channel', align: 'left' },
  { name: 'examples', label: 'Example chat lines', field: 'count', align: 'left' },
]

function setName(channel: number, value: string): void {
  settings.channelNames = { ...settings.channelNames, [channel]: value }
}

function setAlias(channel: number, value: string | number | null): void {
  settings.channelAliases = { ...settings.channelAliases, [channel]: String(value ?? '') }
}
</script>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">Channels</div>
      <div class="text-caption text-grey">
        Choose which channels appear in the output and how they are labeled.
      </div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <q-table
        :rows="session.channelSummaries"
        :columns="columns"
        row-key="channel"
        flat
        bordered
        hide-pagination
        :pagination="{ rowsPerPage: 0 }"
        wrap-cells
      >
        <template #body="props">
          <q-tr :props="props">
            <q-td key="enabled" :props="props">
              <q-checkbox
                :model-value="settings.isChannelEnabled(props.row.channel)"
                @update:model-value="(v: boolean) => settings.setChannelEnabled(props.row.channel, v)"
              />
            </q-td>
            <q-td key="channel" :props="props">
              <div class="text-weight-medium">{{ props.row.baseName }}</div>
              <div class="text-caption text-grey">
                #{{ props.row.channel }} · {{ props.row.count.toLocaleString() }} lines
              </div>
            </q-td>
            <q-td key="name" :props="props">
              <q-select
                dense
                filled
                :options="ALL_CHANNEL_NAMES as unknown as string[]"
                :model-value="settings.channelNames[props.row.channel] ?? props.row.baseName"
                style="min-width: 160px"
                @update:model-value="(v: string) => setName(props.row.channel, v)"
              />
            </q-td>
            <q-td key="alias" :props="props">
              <q-input
                dense
                filled
                :model-value="settings.channelAliases[props.row.channel] ?? ''"
                placeholder="optional"
                style="min-width: 130px"
                @update:model-value="(v) => setAlias(props.row.channel, v)"
              />
            </q-td>
            <q-td key="examples" :props="props" style="max-width: 380px">
              <div
                v-for="ex in props.row.examples"
                :key="ex.index"
                class="ellipsis text-caption"
              >
                {{ ex.from }}: {{ ex.message }}
              </div>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>
