import { debounce } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import Grid from '@mui/material/Grid';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useRef, useState, type ChangeEvent, type JSX, type MouseEvent } from 'react';

import Footer from './components/Footer';
import OutputValue from './components/OutputValue';

import wasm from '../zig-out/bin/unit_data_converter.wasm?init';

const debounce_wait_time = 300; // in ms

const unit_types = ['Byte', 'KiB', 'MiB', 'GiB', 'TiB'];
const floating_format_types = ['scientific', 'decimal'];

const precision_marks = [
  {
    label: '0',
    value: 0,
  },
  {
    label: '10',
    value: 10,
  },
];

interface Cancelable {
  clear(): void;
}

function getNullTerminatedCString(p_buffer: ArrayBuffer, p_offset: number): string {
  const array = new Uint8Array(p_buffer, p_offset);

  let temp = '';
  for (let i = 0; array[i] !== 0; i += 1) {
    temp += String.fromCodePoint(array[i]);
  }

  return temp;
}

function getPrecisionNumber(p_precision: string, p_slider_value: number): number {
  if (p_precision === 'Auto') {
    return -1;
  }

  if (p_slider_value < 0) {
    p_slider_value = 0;
  } else if (p_slider_value > 10) {
    p_slider_value = 10;
  }

  return p_slider_value;
}

export default function App(): JSX.Element {
  const [input_value, setInputValue] = useState('');
  const previous_input_value = useRef('');
  const [input_error_message, setInputErrorMessage] = useState('');

  const [floating_format_type, setFloatingFormatType] = useState('scientific');
  const [floating_precision, setFloatingPrecision] = useState('Auto');
  const slider_enabled = floating_precision === 'Custom';
  const [precision_slider_value, setPrecisionSliderValue] = useState(6);

  const [anchor_element, setAnchorElement] = useState<HTMLElement | null>(null);
  const settings_window_opened = anchor_element !== null;

  const [unit_type, setUnitType] = useState('Byte');
  const [bytes_value, setBytesValue] = useState('');
  const [kib_value, setKiBValue] = useState('');
  const [mib_value, setMiBValue] = useState('');
  const [gib_value, setGiBValue] = useState('');
  const [tib_value, setTiBValue] = useState('');

  const debounced_input_value = useRef<(typeof convertValue & Cancelable) | null>(null);

  function clearValues() {
    setBytesValue('');
    setKiBValue('');
    setMiBValue('');
    setGiBValue('');
    setTiBValue('');
  }

  function clearAllButtonClicked() {
    clearValues();
    setInputValue('');
    setInputErrorMessage('');
    previous_input_value.current = '';
  }

  function settingsButtonClicked(e: MouseEvent<HTMLButtonElement>) {
    setAnchorElement(e.currentTarget);
  }

  function settingsWindowClosed() {
    setAnchorElement(null);
  }

  function floatingFormatTypeChanged(e: ChangeEvent<HTMLInputElement>) {
    setFloatingFormatType(e.target.value);
    convertValue(
      input_value,
      unit_type,
      e.target.value,
      getPrecisionNumber(floating_precision, precision_slider_value),
      false
    );
  }

  function floatingPrecisionChanged(e: ChangeEvent<HTMLInputElement>) {
    setFloatingPrecision(e.target.value);
    convertValue(
      input_value,
      unit_type,
      floating_format_type,
      getPrecisionNumber(e.target.value, precision_slider_value),
      false
    );
  }

  function sliderChanged(_e: Event, p_new_value: number) {
    setPrecisionSliderValue(p_new_value);
  }

  function sliderChangeCommitted(_e: unknown, p_new_value: number) {
    convertValue(input_value, unit_type, floating_format_type, p_new_value, false);
  }

  function unitTypeChanged(e: SelectChangeEvent) {
    setUnitType(e.target.value);
    convertValue(
      input_value,
      e.target.value,
      floating_format_type,
      getPrecisionNumber(floating_precision, precision_slider_value),
      false
    );
  }

  function inputValueChanged(e: ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);

    if (debounced_input_value.current && 'clear' in debounced_input_value.current) {
      debounced_input_value.current.clear();
    }

    debounced_input_value.current = debounce(convertValue, debounce_wait_time);
    debounced_input_value.current(
      e.target.value,
      unit_type,
      floating_format_type,
      getPrecisionNumber(floating_precision, precision_slider_value),
      true
    );
  }

  function convertValue(
    p_value: string,
    p_unit_type: string,
    p_format_type: string,
    p_precision_number: number,
    p_abort_if_equal_to_previous_value: boolean
  ) {
    setInputErrorMessage('');

    if (!p_value) {
      previous_input_value.current = '';
      clearValues();
      return;
    }

    wasm()
      .then((p_instance: WebAssembly.Instance) => {
        const exports = p_instance.exports;

        const memory = exports.memory as WebAssembly.Memory | undefined;
        if (!memory) {
          throw new Error('Instance memory is missing');
        }

        const wasmAlloc = exports.alloc as ((a: number) => number) | undefined;
        if (!wasmAlloc) {
          throw new Error('`wasmAlloc` is missing');
        }

        const wasmFree = exports.free as ((a: number, b: number) => void) | undefined;
        if (!wasmFree) {
          throw new Error('`wasmFree` is missing');
        }

        const ucInit = exports.ucInit as ((a: number, b: number) => number) | undefined;
        if (!ucInit) {
          throw new Error('`ucInit` is missing');
        }

        const ucDeinit = exports.ucDeinit as ((a: number) => void) | undefined;
        if (!ucDeinit) {
          throw new Error('`ucDeinit` is missing');
        }

        const ucGetInitStatus = exports.ucGetInitStatus as ((a: number) => number) | undefined;
        if (!ucGetInitStatus) {
          throw new Error('`ucGetInitStatus` is missing');
        }

        const ucGetCleanedInputValue = exports.ucGetCleanedInputValue as
          | ((a: number) => number)
          | undefined;
        if (!ucGetCleanedInputValue) {
          throw new Error('`ucGetCleanedInputValue` is missing');
        }

        const ucBeginConverting = exports.ucBeginConverting as
          | ((a: number, b: number, c: number, d: number) => boolean)
          | undefined;
        if (!ucBeginConverting) {
          throw new Error('`ucBeginConverting` is missing');
        }

        const ucGetConvertedValue = exports.ucGetConvertedValue as
          | ((handle: number, unit_type: number) => number)
          | undefined;
        if (!ucGetConvertedValue) {
          throw new Error('`ucGetConvertedValue` is missing');
        }

        let handle = 0;
        let rc = 0;

        {
          const text_encoder = new TextEncoder();
          const string_as_utf8 = text_encoder.encode(p_value);

          if (!string_as_utf8.length) {
            throw new Error('Invalid value');
          }

          rc = wasmAlloc(string_as_utf8.length);
          if (!rc) {
            throw new Error('Out of memory');
          }

          const buffer = new Uint8Array(memory.buffer, rc, string_as_utf8.length);
          buffer.set(string_as_utf8);

          handle = ucInit(rc, string_as_utf8.length);
          wasmFree(rc, string_as_utf8.length);
        }

        if (!handle) {
          throw new Error('Unable to create handle');
        }

        rc = ucGetInitStatus(handle);
        if (rc) {
          ucDeinit(handle);

          switch (rc) {
            // Value is `0`
            case 1:
              previous_input_value.current = '';
              clearValues();
              return;
            // Value is empty
            case 2:
              setInputValue('');
              previous_input_value.current = '';
              clearValues();
              return;
            // Invalid value
            case 3:
              throw new Error('Invalid value');
            // Very rare, but just in case an invalid opaque handle is used:
            case 4:
              throw new Error('Invalid UC handle');
            case 0:
              // `0` is unreachable, but it's not like there's an `unreachable` keyword in
              // JavaScript...
              break;
            default:
              throw new Error('Unexpected error');
          }
        }

        {
          rc = ucGetCleanedInputValue(handle);
          if (!rc) {
            ucDeinit(handle);
            setInputValue('');
            previous_input_value.current = '';
            throw new Error('Internal error');
          }

          const cleaned_input = getNullTerminatedCString(memory.buffer, rc);
          setInputValue(cleaned_input);

          if (
            p_abort_if_equal_to_previous_value &&
            previous_input_value.current === cleaned_input
          ) {
            ucDeinit(handle);
            return;
          }

          previous_input_value.current = cleaned_input;
        }

        rc = +ucBeginConverting(
          handle,
          unit_types.indexOf(p_unit_type),
          floating_format_types.indexOf(p_format_type),
          p_precision_number
        );

        if (!rc) {
          ucDeinit(handle);
          throw new Error('Invalid value');
        }

        {
          let new_value = '';

          rc = ucGetConvertedValue(handle, 0);
          if (rc) {
            new_value = getNullTerminatedCString(memory.buffer, rc);
            setBytesValue(new_value);
          }

          rc = ucGetConvertedValue(handle, 1);
          if (rc) {
            new_value = getNullTerminatedCString(memory.buffer, rc);
            setKiBValue(new_value);
          }

          rc = ucGetConvertedValue(handle, 2);
          if (rc) {
            new_value = getNullTerminatedCString(memory.buffer, rc);
            setMiBValue(new_value);
          }

          rc = ucGetConvertedValue(handle, 3);
          if (rc) {
            new_value = getNullTerminatedCString(memory.buffer, rc);
            setGiBValue(new_value);
          }

          rc = ucGetConvertedValue(handle, 4);
          if (rc) {
            new_value = getNullTerminatedCString(memory.buffer, rc);
            setTiBValue(new_value);
          }
        }

        ucDeinit(handle);
      })
      .catch((reason: unknown) => {
        clearValues();

        if (reason instanceof Error) {
          setInputErrorMessage(reason.message);
          console.error(reason);
        }
      });
  }

  return (
    <Stack sx={{ height: '100dvh' }}>
      <Grid container columns={2} flex={1} sx={{ '*': { fontSize: '24px' } }}>
        <Grid
          alignItems={'center'}
          container
          justifyContent={'center'}
          size={1}
          sx={{ backgroundColor: '#212121' }}
        >
          <Stack padding={4} spacing={2} sx={{ backgroundColor: '#111' }}>
            <Stack alignItems={'flex-start'} direction={'row'} spacing={2}>
              <TextField
                error={input_error_message.length > 0}
                helperText={input_error_message}
                onChange={inputValueChanged}
                placeholder="1,024"
                value={input_value}
                variant="standard"
              />
              <Select label="Unit" onChange={unitTypeChanged} value={unit_type} variant="standard">
                <MenuItem value={'Byte'}>Byte</MenuItem>
                <MenuItem value={'KiB'}>Kibibyte (KiB)</MenuItem>
                <MenuItem value={'MiB'}>Mebibyte (MiB)</MenuItem>
                <MenuItem value={'GiB'}>Gibibyte (GiB)</MenuItem>
                <MenuItem value={'TiB'}>Tebibyte (TiB)</MenuItem>
              </Select>
            </Stack>
            <Stack direction={'row'} justifyContent={'center'} spacing={2}>
              <Button onClick={settingsButtonClicked} variant="outlined">
                Settings
              </Button>
              <Button color="error" onClick={clearAllButtonClicked} variant="outlined">
                Clear All
              </Button>
            </Stack>
            <Menu
              anchorEl={anchor_element}
              onClose={settingsWindowClosed}
              open={settings_window_opened}
            >
              <Box paddingX={2} paddingY={1}>
                <FormControl>
                  <FormLabel>Floating Format</FormLabel>
                  <RadioGroup onChange={floatingFormatTypeChanged} value={floating_format_type}>
                    <FormControlLabel value={'scientific'} control={<Radio />} label="Scientific" />
                    <FormControlLabel value={'decimal'} control={<Radio />} label="Decimal" />
                  </RadioGroup>
                </FormControl>
              </Box>
              <Box paddingX={2} paddingY={1}>
                <FormControl>
                  <FormLabel>Floating Precision</FormLabel>
                  <RadioGroup onChange={floatingPrecisionChanged} value={floating_precision}>
                    <FormControlLabel control={<Radio />} label="Auto" value={'Auto'} />
                    <FormControlLabel control={<Radio />} label="Custom" value={'Custom'} />
                  </RadioGroup>
                  <Slider
                    disabled={!slider_enabled}
                    marks={precision_marks}
                    max={10}
                    min={0}
                    onChange={sliderChanged}
                    onChangeCommitted={sliderChangeCommitted}
                    value={precision_slider_value}
                    valueLabelDisplay="auto"
                  />
                </FormControl>
              </Box>
            </Menu>
          </Stack>
        </Grid>
        <Grid
          alignItems={'center'}
          container
          direction={'row'}
          // height={'100dvh'}
          justifyContent={'center'}
          // overflow={'hidden auto'}
          padding={'2em'}
          size={1}
        >
          <Stack padding={4} spacing={2}>
            <OutputValue button_enabled={Boolean(bytes_value)} label="Bytes" value={bytes_value} />
            <OutputValue button_enabled={Boolean(kib_value)} label="KiB" value={kib_value} />
            <OutputValue button_enabled={Boolean(mib_value)} label="MiB" value={mib_value} />
            <OutputValue button_enabled={Boolean(gib_value)} label="GiB" value={gib_value} />
            <OutputValue button_enabled={Boolean(tib_value)} label="TiB" value={tib_value} />
          </Stack>
        </Grid>
      </Grid>
      <Footer />
    </Stack>
  );
}
