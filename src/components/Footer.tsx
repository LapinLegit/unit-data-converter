import { type JSX } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';

export default function Footer(): JSX.Element {
  return (
    <Stack
      direction={'row'}
      divider={<Divider flexItem orientation="vertical" />}
      flex={0}
      justifyContent={'center'}
      padding={1}
      spacing={1}
    >
      <Box>
        by <Link href="https://github.com/lapin-axilla">Lapin</Link>
      </Box>
      <Link href="https://github.com/lapin-axilla/unit-data-converter">Source Code</Link>
      <Box>
        Licensed under{' '}
        <Link href="https://github.com/lapin-axilla/unit-data-converter/blob/master/LICENSE">
          MIT
        </Link>
      </Box>
    </Stack>
  );
}
