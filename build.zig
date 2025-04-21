pub fn build(b: *std.Build) void {
    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const optimize = b.standardOptimizeOption(.{});

    const wasm_module = b.createModule(.{
        .root_source_file = b.path("src/wasm/unit_data_converter.zig"),
        .target = wasm_target,
        .optimize = optimize,
        .link_libc = false,
        .link_libcpp = false,
        .single_threaded = true,
        .strip = optimize == .ReleaseSmall,
        .valgrind = false,
        .omit_frame_pointer = false,
        .error_tracing = false,
    });

    wasm_module.export_symbol_names = wasm_exported_symbols;

    const wasm = b.addExecutable(.{
        .name = "unit_data_converter",
        .root_module = wasm_module,
    });

    wasm.entry = .disabled;

    b.installArtifact(wasm);

    const exe_unit_tests = b.addTest(.{
        .root_module = wasm_module,
    });

    const run_exe_unit_tests = b.addRunArtifact(exe_unit_tests);

    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_exe_unit_tests.step);
}

const std = @import("std");

const wasm_exported_symbols = &[_][]const u8{
    "alloc",
    "free",
    "ucInit",
    "ucDeinit",
    "ucGetInitStatus",
    "ucGetCleanedInputValue",
    "ucBeginConverting",
    "ucGetConvertedValue",
};
