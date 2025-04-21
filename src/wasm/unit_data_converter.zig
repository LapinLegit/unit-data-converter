export fn alloc(p_length: i32) ?[*]u8 {
    if (p_length <= 0) return null;

    const _length = std.math.lossyCast(usize, p_length);
    const _ptr = allocator.alloc(u8, _length) catch {
        return null;
    };

    return _ptr.ptr;
}

export fn free(p_ptr: ?[*]const u8, p_ptr_length: i32) void {
    if (p_ptr == null) return;
    if (p_ptr_length <= 0) return;
    const _ptr_length = std.math.lossyCast(usize, p_ptr_length);
    const _ptr = p_ptr.?[0.._ptr_length];
    allocator.free(_ptr);
}

export fn ucInit(p_ptr: ?[*]const u8, p_ptr_length: i32) ?*anyopaque {
    if (p_ptr == null) return null;
    if (p_ptr_length <= 0) return null;

    const _ptr_length = std.math.lossyCast(usize, p_ptr_length);
    const _input_value = p_ptr.?[0.._ptr_length];

    const _handle = init(_input_value) catch return null;
    return @ptrCast(_handle);
}

export fn ucDeinit(p_handle: ?*anyopaque) void {
    if (p_handle == null) return;
    const _handle: *Handle = @alignCast(@ptrCast(p_handle.?));
    _handle.deinit();
    allocator.destroy(_handle);
}

export fn ucGetInitStatus(p_handle: ?*anyopaque) i32 {
    if (p_handle == null) return 4;
    const _handle: *Handle = @alignCast(@ptrCast(p_handle.?));
    return @intFromEnum(_handle.value_status);
}

export fn ucGetCleanedInputValue(p_handle: ?*anyopaque) ?[*]const u8 {
    if (p_handle == null) return null;

    const _handle: *Handle = @alignCast(@ptrCast(p_handle.?));

    if (_handle.input_value == null or _handle.input_value.?.len == 0) {
        @branchHint(.cold);
        return null;
    }

    return @ptrCast(_handle.input_value.?.ptr);
}

export fn ucBeginConverting(p_handle: ?*anyopaque, p_unit_type: i32, p_format_type: i32, p_precision: i32) bool {
    if (p_handle == null) return false;

    const _unit_type = std.meta.intToEnum(UnitType, p_unit_type) catch {
        return false;
    };

    const _format_type = std.meta.intToEnum(std.fmt.format_float.Format, p_format_type) catch {
        return false;
    };

    const _precision: ?usize = switch (p_precision) {
        0...10 => @intCast(p_precision),
        else => null,
    };

    const _floating_format_options = std.fmt.format_float.FormatOptions{
        .mode = _format_type,
        .precision = _precision,
    };

    const _handle: *Handle = @alignCast(@ptrCast(p_handle.?));
    beginConverting(_handle, _unit_type, _floating_format_options) catch return false;
    return true;
}

export fn ucGetConvertedValue(p_handle: ?*anyopaque, p_unit_type: i32) ?[*]const u8 {
    if (p_handle == null) return null;
    const _unit_type = std.meta.intToEnum(UnitType, p_unit_type) catch return null;
    const _handle: *Handle = @alignCast(@ptrCast(p_handle));

    return (_handle.data.get(_unit_type) orelse return null).ptr;
}

fn init(p_value: []const u8) !*Handle {
    const _handle = try allocator.create(Handle);
    _handle.* = Handle.init(allocator);

    errdefer {
        _handle.deinit();
        allocator.destroy(_handle);
    }

    var _buffer = std.ArrayList(u8).init(_handle.allocator);
    errdefer _buffer.deinit();

    var _is_float = false;

    for (p_value) |_b| {
        switch (_b) {
            ' ', '_', ',', '\n', '\r' => continue,
            0 => break,
            else => {
                if (_b == '.') _is_float = true;
                try _buffer.append(_b);
            },
        }
    }

    if (_buffer.items.len == 0) {
        _handle.value_status = .ValueIsBlank;
        return _handle;
    }

    if (_is_float) {
        const _float = std.fmt.parseFloat(f128, _buffer.items) catch {
            _handle.value_status = .InvalidValue;
            return _handle;
        };

        _handle.value = Variant.floored(_float);
    } else {
        const _int = std.fmt.parseInt(i128, _buffer.items, 0) catch {
            _handle.value_status = .InvalidValue;
            return _handle;
        };

        _handle.value = Variant{ .int = _int };
    }

    if (_handle.value.isZero()) {
        _handle.value_status = .ValueIsZero;
        return _handle;
    }

    _handle.input_value = try _buffer.toOwnedSliceSentinel(0);
    return _handle;
}

fn beginConverting(p_handle: *Handle, p_unit_type: UnitType, p_format_opt: std.fmt.format_float.FormatOptions) !void {
    var _byte: Variant = undefined;

    switch (p_unit_type) {
        .Byte => _byte = p_handle.value,
        .KiB => {
            var _float = p_handle.value.toFloat();
            _float *= kib_pow;
            _byte = Variant.floored(_float);
        },
        .MiB => {
            var _float = p_handle.value.toFloat();
            _float *= mib_pow;
            _byte = Variant.floored(_float);
        },
        .GiB => {
            var _float = p_handle.value.toFloat();
            _float *= gib_pow;
            _byte = Variant.floored(_float);
        },
        .TiB => {
            var _float = p_handle.value.toFloat();
            _float *= tib_pow;
            _byte = Variant.floored(_float);
        },
    }

    const _buffer = try allocator.alloc(u8, 1 << 13);
    defer allocator.free(_buffer);

    try p_handle.data.put(.Byte, try p_handle.allocator.dupeZ(u8, try _byte.toString(_buffer, p_format_opt)));

    if (!p_handle.data.contains(p_unit_type)) {
        try p_handle.data.put(p_unit_type, try p_handle.allocator.dupeZ(u8, try p_handle.value.toString(_buffer, p_format_opt)));
    }

    if (!p_handle.data.contains(.KiB)) {
        const _foo = Variant.floored(_byte.toFloat() * byte_to_kib);
        try p_handle.data.put(.KiB, try p_handle.allocator.dupeZ(u8, try _foo.toString(_buffer, p_format_opt)));
    }

    if (!p_handle.data.contains(.MiB)) {
        const _foo = Variant.floored(_byte.toFloat() * byte_to_mib);
        try p_handle.data.put(.MiB, try p_handle.allocator.dupeZ(u8, try _foo.toString(_buffer, p_format_opt)));
    }

    if (!p_handle.data.contains(.GiB)) {
        const _foo = Variant.floored(_byte.toFloat() * byte_to_gib);
        try p_handle.data.put(.GiB, try p_handle.allocator.dupeZ(u8, try _foo.toString(_buffer, p_format_opt)));
    }

    if (!p_handle.data.contains(.TiB)) {
        const _foo = Variant.floored(_byte.toFloat() * byte_to_tib);
        try p_handle.data.put(.TiB, try p_handle.allocator.dupeZ(u8, try _foo.toString(_buffer, p_format_opt)));
    }
}

const std = @import("std");
const allocator = std.heap.page_allocator;

const UnitType = enum(u8) {
    Byte,
    KiB,
    MiB,
    GiB,
    TiB,
};

const kib_pow = std.math.pow(i128, 1024, 1);
const mib_pow = std.math.pow(i128, 1024, 2);
const gib_pow = std.math.pow(i128, 1024, 3);
const tib_pow = std.math.pow(i128, 1024, 4);

const kib_pow_f = std.math.pow(f64, 1024, 1);
const mib_pow_f = std.math.pow(f64, 1024, 2);
const gib_pow_f = std.math.pow(f64, 1024, 3);
const tib_pow_f = std.math.pow(f64, 1024, 4);

const byte_to_kib = 1.0 / kib_pow_f;
const byte_to_mib = 1.0 / mib_pow_f;
const byte_to_gib = 1.0 / gib_pow_f;
const byte_to_tib = 1.0 / tib_pow_f;

const Variant = union(enum) {
    int: i128,
    float: f128,

    fn floored(p_value: anytype) Variant {
        const _floored = std.math.floor(p_value);

        return if (_floored == p_value)
            Variant{ .int = @intFromFloat(_floored) }
        else
            Variant{ .float = p_value };
    }

    fn toFloat(self: Variant) f128 {
        return switch (self) {
            .int => |_int| std.math.lossyCast(f128, _int),
            .float => |_float| _float,
        };
    }

    fn isZero(self: Variant) bool {
        return switch (self) {
            .int => |_int| _int == 0,
            .float => |_float| _float == 0,
        };
    }

    fn toString(self: Variant, p_buf: []u8, p_opt: std.fmt.format_float.FormatOptions) ![]const u8 {
        switch (self) {
            .int => |_int| return std.fmt.bufPrint(p_buf, "{d}", .{_int}),
            .float => |_float| return std.fmt.formatFloat(p_buf, _float, p_opt),
        }
    }
};

const ValueStatus = enum(u8) {
    OK,
    ValueIsZero,
    ValueIsBlank,
    InvalidValue,
};

const Handle = struct {
    allocator: std.mem.Allocator,

    value: Variant,
    value_status: ValueStatus = .OK,
    input_value: ?[:0]u8 = null,
    is_float: bool = false,

    data: std.AutoHashMap(UnitType, [:0]u8),

    fn init(p_allocator: std.mem.Allocator) Handle {
        return .{
            .allocator = p_allocator,
            .value = undefined,
            .data = @FieldType(Handle, "data").init(p_allocator),
        };
    }

    fn deinit(self: *Handle) void {
        var iter = self.data.valueIterator();
        while (iter.next()) |_value| {
            if (_value.len == 0) continue;
            self.allocator.free(_value.*);
        }
        self.data.deinit();

        if (self.input_value != null) {
            if (self.input_value.?.len > 0) {
                self.allocator.free(self.input_value.?);
            }
            self.input_value = null;
        }
    }
};
