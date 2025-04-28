import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Card,
  Stack,
  Divider,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ScaleOptions,
  ChartData,
  PieController,
  ArcElement,
} from 'chart.js';
import { Bar, Scatter, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PieController,
  ArcElement
);

interface Requirement {
  key: string;
  summary: string;
  score?: number;
  rank?: number;
  criteria: Record<string, number>;
  customers?: string[];
}

interface ScoreRange {
  min: number;
  max: number;
  count: number;
}

interface ScatterDataPoint {
  x: number;
  y: number;
}

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ children, height = 400 }) => (
  <Paper 
    elevation={1} 
    sx={{ 
      p: 3, 
      bgcolor: '#fff',
      borderRadius: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
    }}
  >
    <Box sx={{ height }}>
      {children}
    </Box>
  </Paper>
);

const Analytics: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/requirements');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      // Extract requirements array from the nested response
      const requirementsData = result.data || [];
      
      if (!Array.isArray(requirementsData)) {
        throw new Error('Invalid data format: expected an array of requirements');
      }
      setRequirements(requirementsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  };

  const distributionData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'Weighted Scores',
          data: [],
          backgroundColor: 'rgba(135, 206, 250, 0.8)',
          borderColor: 'rgba(135, 206, 250, 0.8)',
          borderWidth: 1,
          barThickness: 20,
        }]
      };
    }

    const ranges: ScoreRange[] = Array.from({ length: 10 }, (_, i) => ({
      min: i * 10,
      max: (i + 1) * 10,
      count: 0
    }));

    requirements.forEach(req => {
      const scorePercentage = ((req.score ?? 0) * 100);
      const rangeIndex = Math.min(Math.floor(scorePercentage / 10), 9);
      ranges[rangeIndex].count++;
    });

    return {
      labels: ranges.map(r => `${r.min}-${r.max}%`),
      datasets: [{
        label: 'Weighted Scores',
        data: ranges.map(r => r.count),
        backgroundColor: 'rgba(135, 206, 250, 0.8)',
        borderColor: 'rgba(135, 206, 250, 0.8)',
        borderWidth: 1,
        barThickness: 20,
      }]
    };
  }, [requirements]);

  const criteriaData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 1,
        }]
      };
    }

    const criteriaCount: Record<string, number> = {};
    let totalCriteria = 0;

    requirements.forEach(req => {
      if (req.criteria) {
        Object.entries(req.criteria).forEach(([criterion, value]) => {
          if (value > 0) {
            criteriaCount[criterion] = (criteriaCount[criterion] || 0) + 1;
            totalCriteria++;
          }
        });
      }
    });

    const labels = Object.keys(criteriaCount);
    const data = labels.map(label => (criteriaCount[label] / requirements.length) * 100);

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  const customerData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 1,
        }]
      };
    }

    const customerCount: Record<string, number> = {};
    let totalCustomers = 0;

    requirements.forEach(req => {
      if (req.customers && Array.isArray(req.customers)) {
        req.customers.forEach(customer => {
          if (customer) {
            customerCount[customer] = (customerCount[customer] || 0) + 1;
            totalCustomers++;
          }
        });
      }
    });

    const labels = Object.keys(customerCount);
    const data = labels.map(label => (customerCount[label] / requirements.length) * 100);

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 159, 64, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  const scatterData = useMemo(() => {
    const sortedReqs = [...requirements].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const data: ScatterDataPoint[] = sortedReqs.map(req => ({
      x: req.score ?? 0,
      y: req.rank ?? 0
    }));

    return {
      datasets: [
        {
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          pointStyle: 'circle' as const,
          pointRadius: 5,
          showLine: false,
        }
      ]
    };
  }, [requirements]);

  const pieChartOptions = useMemo<ChartOptions<'pie'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 15,
          padding: 15,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            return `${context.label}: ${value.toFixed(1)}%`;
          }
        }
      }
    }
  }), []);

  const distributionOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          boxWidth: 15,
          usePointStyle: true,
          padding: 10,
        }
      },
      title: {
        display: true,
        text: 'Requirement Score Distribution',
        align: 'start',
        padding: { bottom: 30 },
        font: {
          size: 14,
          weight: 'normal'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => typeof value === 'number' ? value.toFixed(1) : value
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawTicks: false
        },
        border: {
          dash: [4, 4]
        }
      },
      x: {
        grid: {
          display: false
        },
        border: {
          dash: [4, 4]
        }
      }
    }
  }), []);

  const correlationOptions = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Score vs Rank Correlation',
        align: 'start',
        padding: { bottom: 30 },
        font: {
          size: 14,
          weight: 'normal'
        }
      }
    },
    scales: {
      y: {
        reverse: true,
        ticks: {
          callback: (value) => typeof value === 'number' ? value.toFixed(1) : value
        }
      },
      x: {
        ticks: {
          callback: (value) => typeof value === 'number' ? value.toFixed(2) : value
        }
      }
    }
  }), []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Analytics
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Bar data={distributionData} options={distributionOptions} />
        </Card>
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Scatter data={scatterData} options={correlationOptions} />
        </Card>
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Criteria
          </Typography>
          <Pie data={criteriaData} options={pieChartOptions} />
        </Card>
        <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Customer
          </Typography>
          <Pie data={customerData} options={pieChartOptions} />
        </Card>
      </Box>
    </Stack>
  );
};

export default Analytics; 