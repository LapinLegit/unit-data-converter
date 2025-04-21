import { useRef, useState, type JSX } from 'react';

import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { debounce } from '@mui/material/utils';

interface Cancelable {
  clear(): void;
}

const debounce_wait_time = 2000; // in ms

export default function OutputValue(props: {
  button_enabled: boolean;
  label: string;
  value: string;
}): JSX.Element {
  const [tooltip_opened, setTooltipOpen] = useState(false);

  const debounced_close_tooltip = useRef<(typeof closeTooltip & Cancelable) | null>(null);

  function onButtonClicked() {
    if (!props.value) {
      return;
    }

    void navigator.clipboard.writeText(props.value);
    openTooltip();
  }

  function openTooltip() {
    setTooltipOpen(true);

    if (debounced_close_tooltip.current && 'clear' in debounced_close_tooltip.current) {
      debounced_close_tooltip.current.clear();
    }

    debounced_close_tooltip.current = debounce(closeTooltip, debounce_wait_time);
    debounced_close_tooltip.current();
  }

  function closeTooltip() {
    if (debounced_close_tooltip.current && 'clear' in debounced_close_tooltip.current) {
      debounced_close_tooltip.current.clear();
      debounced_close_tooltip.current = null;
    }

    setTooltipOpen(false);
  }

  return (
    <Stack direction={'row'}>
      <TextField
        placeholder="0"
        slotProps={{
          input: {
            endAdornment: <InputAdornment position="end">{props.label}</InputAdornment>,
            readOnly: true,
          },
        }}
        sx={{ flex: '1' }}
        value={props.value}
      />
      <ClickAwayListener disableReactTree onClickAway={closeTooltip}>
        <Stack sx={{ flex: '0' }}>
          <Tooltip
            disableFocusListener
            disableHoverListener
            onClose={closeTooltip}
            onOpen={openTooltip}
            open={tooltip_opened}
            placement="top"
            slotProps={{ popper: { disablePortal: true } }}
            title="Copied to clipboard!"
          >
            <Button
              disabled={!props.button_enabled}
              onClick={onButtonClicked}
              sx={{ flex: '1' }}
              variant="outlined"
            >
              Copy
            </Button>
          </Tooltip>
        </Stack>
      </ClickAwayListener>
    </Stack>
  );
}
