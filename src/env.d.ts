// The official TypeScript compiler resolves Vue imports through this declaration.
// vue-tsc separately checks each component's script and template in full.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent
  export default component
}
