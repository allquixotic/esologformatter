/*
Copyright 2026 Sean McNamara <smcnam@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Dark, Dialog, Notify } from 'quasar'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.use(Quasar, {
  plugins: { Dark, Dialog, Notify },
  config: {
    // Dark mode is the default; the settings store applies the persisted
    // preference (dark/light/system) on startup.
    dark: true,
  },
})
app.mount('#app')
