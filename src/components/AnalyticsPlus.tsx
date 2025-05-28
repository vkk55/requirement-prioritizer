import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Requirement {
  key: string;
  summary: string;
  customers?: string[];
  relatedCustomers?: string;
  [key: string]: any;
}

const AnalyticsPlus: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "InPlan">("InPlan");
  const [view, setView] = useState<"chart" | "table">("chart");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/requirements");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        const requirementsData = result.data || [];
        if (!Array.isArray(requirementsData)) throw new Error("Invalid data format");
        setRequirements(requirementsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch requirements");
        setRequirements([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredRequirements = useMemo(() =>
    filter === "InPlan"
      ? requirements.filter(
          (r) => (r as any)["InPlan?"] === true
        )
      : requirements,
    [requirements, filter]
  );

  // Unique customer extraction and requirement count
  const customerStats = useMemo(() => {
    // 1. Build a unique customer set from all relatedcustomers fields
    const customerSet = new Set<string>();
    filteredRequirements.forEach((req) => {
      let customers: string[] = [];
      if (Array.isArray((req as any).customers)) {
        customers = (req as any).customers;
      } else if (typeof (req as any).relatedcustomers === "string" && (req as any).relatedcustomers.trim()) {
        customers = (req as any).relatedcustomers.split(",").map((c: string) => c.trim()).filter(Boolean);
      }
      customers.forEach((customer) => {
        if (customer) customerSet.add(customer);
      });
    });
    const uniqueCustomers = Array.from(customerSet);
    // 2. For each customer, count how many requirements they appear in
    const stats = uniqueCustomers.map((customer) => {
      let count = 0;
      filteredRequirements.forEach((req) => {
        let customers: string[] = [];
        if (Array.isArray((req as any).customers)) {
          customers = (req as any).customers;
        } else if (typeof (req as any).relatedcustomers === "string" && (req as any).relatedcustomers.trim()) {
          customers = (req as any).relatedcustomers.split(",").map((c: string) => c.trim()).filter(Boolean);
        }
        if (customers.includes(customer)) count++;
      });
      return {
        customer,
        count,
        percent: filteredRequirements.length > 0 ? (count / filteredRequirements.length) * 100 : 0,
      };
    });
    // Sort by count descending
    stats.sort((a, b) => b.count - a.count);
    return stats;
  }, [filteredRequirements]);

  // Chart data
  const chartData = useMemo(() => ({
    labels: customerStats.map((s) => s.customer),
    datasets: [
      {
        label: "# Requirements",
        data: customerStats.map((s) => s.count),
        backgroundColor: "rgba(54, 162, 235, 0.7)",
        borderRadius: 6,
        datalabels: {
          anchor: 'center',
          align: 'center',
        },
      },
    ],
  }), [customerStats]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const idx = context.dataIndex;
            const stat = customerStats[idx];
            return `${stat.count} (${stat.percent.toFixed(1)}%)`;
          },
        },
      },
      datalabels: {
        anchor: 'center',
        align: 'center',
        color: '#fff',
        font: { weight: 'bold' as const, size: 14 },
        formatter: (value: number, context: any) => {
          const idx = context.dataIndex;
          const stat = customerStats[idx];
          return `${stat.count}\n${stat.percent.toFixed(1)}%`;
        },
      },
    },
    scales: {
      x: { beginAtZero: true, title: { display: false } },
      y: { beginAtZero: true, title: { display: false }, ticks: { precision: 0 } },
    },
  }), [customerStats]);

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Analytics+
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <FormControl size="small">
          <InputLabel id="analyticsplus-filter-label">Filter</InputLabel>
          <Select
            labelId="analyticsplus-filter-label"
            value={filter}
            label="Filter"
            onChange={(e) => setFilter(e.target.value as "All" | "InPlan")}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="InPlan">InPlan</MenuItem>
          </Select>
        </FormControl>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, val) => val && setView(val)}
          size="small"
        >
          <ToggleButton value="chart">Bar Chart</ToggleButton>
          <ToggleButton value="table">Table View</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Card sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Requirements by Customer
            </Typography>
            {view === "chart" ? (
              <Box sx={{ width: "100%", height: 400 }}>
                <Bar data={chartData} options={chartOptions} />
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer Name</TableCell>
                      <TableCell align="right"># Requirements</TableCell>
                      <TableCell align="right">% of Requirements</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customerStats.map((row) => (
                      <TableRow key={row.customer}>
                        <TableCell>{row.customer}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">{row.percent.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Card>
    </Box>
  );
};

export default AnalyticsPlus; 