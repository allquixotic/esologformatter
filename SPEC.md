§G
Make timezone intent explicit. Separate event/range, log-recording, browser zones. Show exact raw-log filter before run.

§C
C1: Keep browser-only processing. No log upload.
C2: Treat ESO timestamp offset as unreliable for filtering. Compare raw wall-clock values.
C3: Default log-recording and custom-range zones to detected browser IANA zone for old-setting compatibility.
C4: Persist user-selected zones. Validate IANA names. Never silently replace invalid values.
C5: Browser zone is detected, read-only context. It must not override explicit log zone.
C6: Existing presets keep their event timezone and naming behavior.
C7: Timezone UI must remain usable on desktop and narrow viewports.
C8: Use official TypeScript 7 compiler; keep official TypeScript 6 compatibility API for vue-tsc and typescript-eslint until they support native API.

§I
I.settings: SettingsState adds logTimezone and customRangeTimezone.
I.zones: Core resolver converts event/range instants into raw log wall-clock bounds.
I.options: Options UI shows browser, log-recording, event/range zones and effective raw-log range.
I.runner: Generate uses same resolved bounds shown by options preview and logs both source and raw-log ranges.

§V
V1: Explicit logTimezone alone controls preset-to-log conversion; browser zone cannot change bounds.
V2: Custom inputs are interpreted in customRangeTimezone, then converted to logTimezone.
V3: Preview raw-log bounds equal runner DateWindowMs bounds for same settings.
V4: Invalid timezone, invalid custom input, or reversed range blocks processing with clear error.
V5: Stale timestamp offsets never shift filtering; existing wall-clock regression stays green.
V6: Missing persisted zone fields default to detected browser zone without losing old settings.
V7: UI shows all three zone roles plus exact inclusive raw-log range before preset/custom processing.
V8: Eastern event + Central log resolves one hour earlier and selects full intended window, not final overlap only.
V9: At 390px, timezone roles stack without page-level horizontal overflow.

§T
id|status|task|cites
T1|x|Add explicit zone model, shared resolver, regression tests|V1,V2,V4,V5,V8,I.zones
T2|x|Persist zone settings and build three-zone options UI|V6,V7,I.settings,I.options
T3|x|Use shared resolver in processing and technical log|V1,V2,V3,V4,I.runner
T4|x|Run full automated and rendered QA|V1,V2,V3,V4,V5,V6,V7,V8,V9

§B
id|date|cause|fix
B1|n/a|implicit browser zone stood in for log-recording zone and shifted shared-log filters|V8
B2|n/a|unwrapped option controls forced the Options card wider than a narrow viewport|V9
B3|2026-10-25|typecheck ran only vue-tsc; direct tsc could not resolve Vue imports|declare Vue modules; run official tsc and vue-tsc together
B4|2026-10-25|TypeScript 7 removed compiler API required by vue-tsc and typescript-eslint|C8; Microsoft-documented package aliases
