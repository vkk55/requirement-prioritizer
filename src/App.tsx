import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Tabs, Tab, Container, CssBaseline, ThemeProvider, createTheme, Card, Divider, Stack } from '@mui/material';
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
    background: {
      default: '#f4f6fa',
      paper: '#fff',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    h6: { fontWeight: 700 },
    h4: { fontWeight: 800 },
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
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={2} sx={{ bgcolor: 'white', color: 'primary.main', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar sx={{ minHeight: 72 }}>
            <Box
              component="img"
              src="/ewizard-logo.png"
              alt="eWizard Logo"
              sx={{ height: 48, mr: 3, borderRadius: 2, boxShadow: 1, bgcolor: 'white' }}
            />
            <Typography variant="h4" component="div" sx={{ flexGrow: 1, fontWeight: 800, letterSpacing: 1 }}>
              eWizard Requirement Prioritizer
            </Typography>
          </Toolbar>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="navigation tabs"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              bgcolor: 'background.paper',
              color: 'primary.main',
              px: 4,
              '.MuiTab-root': { fontWeight: 600, fontSize: 18, minWidth: 120 },
              '.MuiTabs-indicator': { height: 4, borderRadius: 2 },
            }}
          >
            <Tab label="Settings" />
            <Tab label="Import" />
            <Tab label="Score" />
            <Tab label="Rank" />
            <Tab label="Analytics" />
          </Tabs>
        </AppBar>
        <Container maxWidth="lg" sx={{ mt: 5, mb: 5 }}>
          <Card elevation={3} sx={{ p: 4, borderRadius: 4, minHeight: '70vh', boxShadow: 4 }}>
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
          </Card>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
