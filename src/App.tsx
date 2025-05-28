import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Tabs, Tab, Container, CssBaseline, ThemeProvider, createTheme, Card, Divider, Stack, Button } from '@mui/material';
import { Settings } from './components/Settings';
import ImportRequirements from './components/ImportRequirements';
import { Requirements } from './components/Requirements';
import { StackRank } from './components/StackRank';
import Analytics from './components/Analytics';
import AnalyticsPlus from './components/AnalyticsPlus';
import PasswordGate from './components/PasswordGate';
import Plan from './components/Plan';

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
    return isNaN(parsed) ? 0 : parsed;
  });

  useEffect(() => {
    localStorage.setItem('lastTabIndex', String(tabValue));
  }, [tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <PasswordGate>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
          <AppBar position="sticky" elevation={2} sx={{ bgcolor: 'white', color: 'primary.main', borderBottom: 1, borderColor: 'divider', top: 0, zIndex: 1201 }}>
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
              <Button onClick={() => { localStorage.removeItem('pw_ok'); window.location.reload(); }} sx={{ ml: 4, fontWeight: 700 }} color="secondary" variant="outlined">Logout</Button>
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
              <Tab label="Plan" />
              <Tab label="Analytics" />
              <Tab label="Analytics+" />
            </Tabs>
          </AppBar>
          {tabValue === 5 || tabValue === 6 ? (
            <Container maxWidth={false} sx={{ width: '100vw', px: 0, mx: 0, mt: 5, mb: 5, overflow: 'visible' }}>
              <Card elevation={3} sx={{ p: 0, borderRadius: 4, minHeight: '70vh', boxShadow: 4, width: '100vw', overflow: 'visible' }}>
                <TabPanel value={tabValue} index={5}>
                  <Analytics />
                </TabPanel>
                <TabPanel value={tabValue} index={6}>
                  <AnalyticsPlus />
                </TabPanel>
              </Card>
            </Container>
          ) : (
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
                  <Plan />
                </TabPanel>
              </Card>
            </Container>
          )}
        </Box>
      </ThemeProvider>
    </PasswordGate>
  );
}
