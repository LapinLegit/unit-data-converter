# Unit Data Converter

Convert data units, from bytes to kilobytes, megabytes, etc.

This software utilizes [WebAssembly](https://webassembly.org/), not because of
performance reasons, but because I wanted to try to make use of
[Zig](https://ziglang.org)'s `i128` and `f128` types.

## Building

### Prerequisites

- [`zig`](https://ziglang.org/download/#release-0.14.0) (v0.14.0)
- [`pnpm`](https://pnpm.io/installation) (v10.8.1)

### Compiling

```sh
$ zig build install -Doptimize=ReleaseSmall
$ pnpm install
$ pnpm run build
```

## License

[MIT](./LICENSE)
