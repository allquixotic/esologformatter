# esologformatter

https://esologformatter.com

## Development

With Bun 1.4.3 and Node.js 22.13+ (or Node.js 24+):

```sh
bun install --frozen-lockfile --registry=https://registry.npmjs.org
bun run typecheck
bun run lint
bun test
bun run build
```

`typecheck` runs the official TypeScript 7 compiler (`tsc`) and Vue's component
checker (`vue-tsc`). Vue's checker and typescript-eslint still need the TypeScript
6 compiler API, so the development dependencies use Microsoft's
[documented side-by-side aliases](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0):
`@typescript/native` supplies TypeScript 7, while `typescript` resolves to the
official `@typescript/typescript6` compatibility package. Keep both checks.

Maintainer dependency updates are selected through Vulnetix Package Firewall with
the account's seven-day cooldown. Registry authentication stays in temporary
private configuration outside the repository. The committed lockfile retains
public package identities and integrity hashes; the commands above are the
explicit public-registry contributor path and require no Vulnetix credentials.
