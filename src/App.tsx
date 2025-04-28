import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Tabs, Tab, Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { Settings } from './components/Settings';
import ImportRequirements from './components/ImportRequirements';
import { Requirements } from './components/Requirements';
import { StackRank } from './components/StackRank';
import Analytics from './components/Analytics';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function App() {
  const [tabValue, setTabValue] = useState(() => {
    const stored = localStorage.getItem('lastTabIndex');
    const parsed = stored !== null ? parseInt(stored, 10) : 0;
    console.log('Tab persistence: loaded from localStorage', stored, 'parsed as', parsed);
    return isNaN(parsed) ? 0 : parsed;
  });

  useEffect(() => {
    localStorage.setItem('lastTabIndex', String(tabValue));
    console.log('Tab persistence: set localStorage to', tabValue);
  }, [tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static">
          <Toolbar>
            <Box
              component="img"
              src="/ewizard-logo.png"
              alt="eWizard Logo"
              sx={{ height: 40, mr: 2 }}
            />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              eWizard Requirement Prioritizer
            </Typography>
          </Toolbar>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="navigation tabs"
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tab label="Settings" />
            <Tab label="Import" />
            <Tab label="Score" />
            <Tab label="Rank" />
            <Tab label="Analytics" />
          </Tabs>
        </AppBar>
        <Container maxWidth="xl">
          <TabPanel value={tabValue} index={0}>
            <Settings />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <ImportRequirements />
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <Requirements />
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <StackRank />
          </TabPanel>
          <TabPanel value={tabValue} index={4}>
            <Analytics />
          </TabPanel>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
