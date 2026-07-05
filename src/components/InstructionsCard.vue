<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const expanded = computed(() => !session.hasInput)
</script>

<template>
  <q-card flat bordered>
    <q-expansion-item
      :model-value="expanded"
      icon="help_outline"
      label="What's this? How do I use it?"
      header-class="text-subtitle1"
    >
      <q-card-section class="q-pt-none">
        <div class="text-h6 q-mb-sm">What's this?</div>
        <ul class="q-my-none">
          <li>
            A formatting tool for
            <a href="https://elderscrollsonline.com" target="_blank" rel="noopener">Elder Scrolls Online</a>
            chat log files.
          </li>
          <li>
            Turn raw ESO logs into readable plain text, clean roleplay narrative
            ("Name says, …" — the Convocations style), or a legacy HTML table.
          </li>
        </ul>

        <div class="text-h6 q-mt-md q-mb-sm">How do I use it?</div>
        <ul class="q-my-none">
          <li>Enable chat logging in game with the <b>/chatlog</b> command.</li>
          <li>
            Your log lives at
            <code>Documents\Elder Scrolls Online\live\Logs\ChatLog.log</code> (Windows).
          </li>
          <li>Load one or more log files below, tune the options, then hit <b>Generate</b>.</li>
          <li>Event presets can pull out just your weekly RP session, exactly like Convocations.</li>
        </ul>

        <div class="text-h6 q-mt-md q-mb-sm">Legal &amp; privacy</div>
        <ul class="q-my-none">
          <li>
            <b>Legal:</b> This tool is <u>in no way</u> affiliated with, endorsed by, or supported by
            Bethesda Softworks LLC or ZeniMax Online Studios LLC.
          </li>
          <li>
            <b>Privacy:</b> Your logs never leave this browser. The only optional network use is the
            AI correction feature when <i>you</i> connect OpenRouter (your text is then sent to the
            model you choose) — everything else runs 100% locally.
          </li>
          <li>Settings are stored in your browser's local storage. No cookies, no tracking.</li>
        </ul>
      </q-card-section>
    </q-expansion-item>
  </q-card>
</template>
