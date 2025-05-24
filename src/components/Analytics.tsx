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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
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
// @ts-ignore
import ChartDataLabels from 'chartjs-plugin-datalabels';

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
  ArcElement,
  ChartDataLabels
);

interface Requirement {
  key: string;
  summary: string;
  score?: number;
  rank?: number;
  criteria: Record<string, number>;
  customers?: string[];
  relatedCustomers?: string;
  status?: string;
  labels?: string[];
  priority?: string;
  roughEstimate?: string;
  roughestimate?: string;
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
  const [filter, setFilter] = useState<'All' | 'InPlan'>('InPlan');
  const [customerView, setCustomerView] = useState<'chart' | 'table'>('chart');
  const [customerSort, setCustomerSort] = useState<'percent' | 'count'>('percent');
  const [customerSortOrder, setCustomerSortOrder] = useState<'desc' | 'asc'>('desc');
  const [roughEstimateView, setRoughEstimateView] = useState<'chart' | 'table'>('chart');
  const [scoreRangeView, setScoreRangeView] = useState<'chart' | 'table'>('chart');
  const [ownerView, setOwnerView] = useState<'chart' | 'table'>('chart');

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

  // Filter requirements based on filter state
  const filteredRequirements = filter === 'InPlan'
    ? requirements.filter(r => (r as any)["InPlan?"] === true || (r as any).inPlan === true)
    : requirements;

  // Defensive normalization: ensure every requirement has a relatedCustomers string
  const normalizedRequirements = useMemo(() => {
    const result = filteredRequirements.map(req => ({
      ...req,
      relatedCustomers:
        req.relatedCustomers ||
        (req as any).relatedcustomers ||
        (Array.isArray(req.customers) ? req.customers.join(', ') : ''),
      roughEstimate: req.roughEstimate || req.roughestimate || '',
    }));
    console.log('Analytics: normalizedRequirements (roughEstimate, relatedCustomers)', result.map(r => ({ key: r.key, relatedCustomers: r.relatedCustomers, roughEstimate: r.roughEstimate })));
    return result;
  }, [filteredRequirements]);

  const totalRequirements = normalizedRequirements.length;

  const distributionData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
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

    filteredRequirements.forEach(req => {
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
  }, [filteredRequirements]);

  const criteriaData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
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

    filteredRequirements.forEach(req => {
      if (req.criteria) {
        Object.entries(req.criteria).forEach(([criterion, value]) => {
          if (value > 0) {
            criteriaCount[criterion] = (criteriaCount[criterion] || 0) + 1;
            totalCriteria++;
          }
        });
      }
    });

    const criteriaLabels = Object.keys(criteriaCount);
    const criteriaCounts = criteriaLabels.map(label => criteriaCount[label]);
    const criteriaPercents = criteriaLabels.map(label => (criteriaCount[label] / filteredRequirements.length) * 100);
    const criteriaData = {
      labels: criteriaLabels,
      datasets: [{
        data: criteriaPercents,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
        datalabels: {
          anchor: 'center' as const,
          align: 'center' as const,
          formatter: (value: number, context: any) => {
            const count = criteriaCounts[context.dataIndex];
            return `${count} (${value.toFixed(1)}%)`;
          },
          font: { weight: 'bold' as "bold" },
          color: '#333',
        },
      }],
    };

    return criteriaData;
  }, [filteredRequirements]);

  // --- Requirements by Customer (unique requirements only) ---
  const customerCount: Record<string, Set<string>> = {};
  normalizedRequirements.forEach(req => {
    let customers: string[] = [];
    if (Array.isArray(req.customers)) {
      customers = req.customers;
    } else if (typeof req.relatedCustomers === 'string' && req.relatedCustomers.trim()) {
      customers = req.relatedCustomers.split(',').map(c => c.trim()).filter(Boolean);
    }
    customers.forEach(customer => {
      if (customer) {
        if (!customerCount[customer]) customerCount[customer] = new Set();
        customerCount[customer].add(req.key);
      }
    });
  });
  const customerEntries = Object.entries(customerCount).sort((a, b) => b[1].size - a[1].size);
  const customerLabels = customerEntries.map(([label]) => label);
  const customerDataArr = customerEntries.map(([, set]) => set.size);
  const customerPercentArr = customerDataArr.map(count =>
    totalRequirements > 0 ? (count / totalRequirements) * 100 : 0
  );
  const customerData = {
    labels: customerLabels,
    datasets: [{
      data: customerDataArr,
      backgroundColor: [
        'rgba(255, 159, 64, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 99, 132, 0.8)',
      ],
      borderWidth: 1,
    }],
  };
  const hasCustomerData = customerDataArr.length > 0;
  const customerBarOptions = {
    indexAxis: 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      datalabels: hasCustomerData ? {
        anchor: 'end' as const,
        align: 'start' as const,
        rotation: -90,
        font: { weight: 'bold' as "bold", size: 14 },
        color: '#fff',
        clamp: true,
        formatter: (value: number, context: any) => {
          try {
            const arr = customerPercentArr;
            const idx = context.dataIndex;
            if (!Array.isArray(arr) || idx >= arr.length || typeof arr[idx] !== 'number') return '';
            return `${value} (${arr[idx].toFixed(1)}%)`;
          } catch { return ''; }
        },
      } : undefined,
    },
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true },
    },
  };

  const statusData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const statusCount: Record<string, number> = {};
    filteredRequirements.forEach(req => {
      const status = req.status || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    const labels = Object.keys(statusCount);
    const data = labels.map(label => statusCount[label]);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 205, 86, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [filteredRequirements]);

  const labelData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const labelCount: Record<string, number> = {};
    filteredRequirements.forEach(req => {
      let labels: string[] = [];
      if (Array.isArray(req.labels)) {
        labels = req.labels as string[];
      } else if (typeof req.labels === 'string' && req.labels && String.prototype.trim.call(req.labels)) {
        labels = (req.labels as string).split(',').map((l: string) => l.trim()).filter(Boolean);
      }
      labels.forEach(label => {
        if (label) {
          labelCount[label] = (labelCount[label] || 0) + 1;
        }
      });
    });
    const labels = Object.keys(labelCount);
    const data = labels.map(label => labelCount[label]);
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
  }, [filteredRequirements]);

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

  const scoreRangeData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const ranges = [
      { label: '1-2', min: 1, max: 2 },
      { label: '2-3', min: 2, max: 3 },
      { label: '3-4', min: 3, max: 4 },
      { label: '4-5', min: 4, max: 5.0001 }, // include 5 in last bucket
    ];
    const rangeCounts = [0, 0, 0, 0];
    filteredRequirements.forEach(req => {
      const score = typeof req.score === 'number' ? req.score : null;
      if (score !== null) {
        for (let i = 0; i < ranges.length; i++) {
          if (score >= ranges[i].min && score < ranges[i].max) {
            rangeCounts[i]++;
            break;
          }
        }
      }
    });
    return {
      labels: ranges.map(r => r.label),
      datasets: [{
        data: rangeCounts,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [filteredRequirements]);

  // --- Requirements by Priority Bar Chart ---
  const priorityData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const priorityCount: Record<string, number> = {};
    filteredRequirements.forEach(req => {
      const priority = req.priority || 'Unknown';
      priorityCount[priority] = (priorityCount[priority] || 0) + 1;
    });
    const labels = Object.keys(priorityCount);
    const data = labels.map(label => priorityCount[label]);
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
  }, [filteredRequirements]);

  // --- Bar chart options for horizontal bar ---
  const horizontalBarOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true },
    },
  };

  // --- Bar chart options for vertical bar ---
  const verticalBarOptions = {
    indexAxis: 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true },
    },
  };

  // --- Requirements by Product Owner Bar Chart ---
  const productOwnerData = useMemo(() => {
    if (!Array.isArray(filteredRequirements) || filteredRequirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const ownerCount: Record<string, number> = {};
    filteredRequirements.forEach(req => {
      const owner = (req as any).productOwner || 'Unassigned';
      ownerCount[owner] = (ownerCount[owner] || 0) + 1;
    });
    const labels = Object.keys(ownerCount);
    const data = labels.map(label => ownerCount[label]);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [filteredRequirements]);

  // Sort customer table view
  const customerTableRows = Array.isArray(customerLabels) && Array.isArray(customerDataArr) && Array.isArray(customerPercentArr)
    ? customerLabels.map((label, idx) => ({
        label,
        count: customerDataArr[idx],
        percent: customerPercentArr[idx],
      }))
    : [];
  customerTableRows.sort((a, b) => {
    if (customerSort === 'count') {
      return customerSortOrder === 'desc' ? b.count - a.count : a.count - b.count;
    } else {
      return customerSortOrder === 'desc' ? b.percent - a.percent : a.percent - b.percent;
    }
  });

  // Calculate rough estimate by customer
  const customerRoughEstimate: Record<string, number> = {};
  normalizedRequirements.forEach(req => {
    let customers: string[] = [];
    if (Array.isArray(req.customers)) {
      customers = req.customers;
    } else if (typeof req.relatedCustomers === 'string' && req.relatedCustomers.trim()) {
      customers = req.relatedCustomers.split(',').map(c => c.trim()).filter(Boolean);
    }
    const roughEstimate = parseFloat((req as any).roughEstimate || '0') || 0;
    if (roughEstimate > 0) {
      customers.forEach(customer => {
        if (customer) {
          customerRoughEstimate[customer] = (customerRoughEstimate[customer] || 0) + roughEstimate;
        }
      });
    }
  });
  const roughEstimateEntries = Object.entries(customerRoughEstimate).sort((a, b) => b[1] - a[1]);
  const roughEstimateLabels = roughEstimateEntries.map(([label]) => label);
  const roughEstimateDataArr = roughEstimateEntries.map(([, sum]) => sum);
  const roughEstimatePercentArr = roughEstimateDataArr.map(sum =>
    totalRoughEstimateAll > 0 ? Math.round((sum / totalRoughEstimateAll) * 100) : 0
  );
  const roughEstimateData = {
    labels: roughEstimateLabels,
    datasets: [{
      data: roughEstimateDataArr,
      backgroundColor: [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
      ],
      borderWidth: 1,
    }],
  };
  const roughEstimateTableRows = Array.isArray(roughEstimateLabels) && Array.isArray(roughEstimateDataArr) && Array.isArray(roughEstimatePercentArr)
    ? roughEstimateLabels.map((label, idx) => ({
        label,
        sum: roughEstimateDataArr[idx],
        percent: roughEstimatePercentArr[idx],
      }))
    : [];

  // For Requirements by Score Range, make the chart larger, add # and % to the chart, and add a table view
  const scoreRangeLabels = scoreRangeData.labels;
  const scoreRangeCounts = scoreRangeData.datasets[0].data;
  const scoreRangePercents = scoreRangeCounts.map((count: number) => (count / totalRequirements) * 100);
  const scoreRangeTableRows = Array.isArray(scoreRangeLabels) && Array.isArray(scoreRangeCounts) && Array.isArray(scoreRangePercents)
    ? scoreRangeLabels.map((label: string, idx: number) => ({
        label,
        count: scoreRangeCounts[idx],
        percent: scoreRangePercents[idx],
      }))
    : [];
  const scoreRangeDataWithLabels = {
    ...scoreRangeData,
    datasets: [{
      ...scoreRangeData.datasets[0],
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        formatter: (value: number, context: any) => {
          const arr = scoreRangePercents;
          const idx = context.dataIndex;
          const percent = Array.isArray(arr) && idx < arr.length && typeof arr[idx] === 'number' ? arr[idx] : 0;
          return `${value} (${percent.toFixed(1)}%)`;
        },
        font: { weight: 'bold' as "bold" },
        color: '#333',
      },
    }],
  };

  // For Requirements by Product Owner, add % of total to the chart and add a table view
  const ownerLabels = Object.keys(productOwnerData.labels);
  const ownerCounts = productOwnerData.datasets[0].data;
  const ownerTotal = ownerCounts.reduce((a: number, b: number) => a + b, 0) || 1;
  const ownerPercents = ownerCounts.map((count: number) => (count / ownerTotal) * 100);
  const ownerTableRows = Array.isArray(ownerLabels) && Array.isArray(ownerCounts) && Array.isArray(ownerPercents)
    ? ownerLabels.map((label: string, idx: number) => ({
        label,
        count: ownerCounts[idx],
        percent: ownerPercents[idx],
      }))
    : [];
  const productOwnerDataWithLabels = {
    ...productOwnerData,
    datasets: [{
      ...productOwnerData.datasets[0],
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        formatter: (value: number, context: any) => {
          const arr = ownerPercents;
          const idx = context.dataIndex;
          const percent = Array.isArray(arr) && idx < arr.length && typeof arr[idx] === 'number' ? arr[idx] : 0;
          return `${value} (${percent.toFixed(1)}%)`;
        },
        font: { weight: 'bold' as "bold" },
        color: '#333',
      },
    }],
  };

  const roughEstimateBarOptions = {
    indexAxis: 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      datalabels: {
        anchor: 'end' as const,
        align: 'start' as const,
        rotation: -90,
        formatter: (value: number, context: any) => {
          const arr = roughEstimatePercentArr;
          const idx = context.dataIndex;
          const percent = Array.isArray(arr) && idx < arr.length && typeof arr[idx] === 'number' ? arr[idx] : 0;
          return `${value} (${percent.toFixed(1)}%)`;
        },
        font: { weight: 'bold' as "bold", size: 14 },
        color: '#fff',
        clamp: true,
      },
    },
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true },
    },
  };

  // 1. Calculate total requirements and total rough estimate
  const totalRoughEstimateAll = normalizedRequirements.reduce(
    (sum, req) => sum + (parseFloat(req.roughEstimate || '0') || 0),
    0
  );

  // 3. Calculate rough estimate by product owner
  const ownerRoughEstimate: Record<string, number> = {};
  normalizedRequirements.forEach(req => {
    const owner = (req as any).productOwner || 'Unassigned';
    const roughEstimate = parseFloat((req as any).roughEstimate || '0') || 0;
    if (roughEstimate > 0) {
      ownerRoughEstimate[owner] = (ownerRoughEstimate[owner] || 0) + roughEstimate;
    }
  });
  const ownerRoughEstimateEntries = Object.entries(ownerRoughEstimate).sort((a, b) => b[1] - a[1]);
  const ownerRoughEstimateLabels = ownerRoughEstimateEntries.map(([label]) => label);
  const ownerRoughEstimateDataArr = ownerRoughEstimateEntries.map(([, sum]) => sum);
  const ownerRoughEstimateTotal = ownerRoughEstimateDataArr.reduce((a, b) => a + b, 0) || 1;
  const ownerRoughEstimatePercentArr = ownerRoughEstimateDataArr.map(sum =>
    ownerRoughEstimateTotal > 0 ? Math.round((sum / ownerRoughEstimateTotal) * 100) : 0
  );
  const ownerRoughEstimateData = {
    labels: ownerRoughEstimateLabels,
    datasets: [{
      data: ownerRoughEstimateDataArr,
      backgroundColor: [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
      ],
      borderWidth: 1,
      datalabels: {
        anchor: 'end' as const,
        align: 'start' as const,
        rotation: -90,
        formatter: (value: number, context: any) => {
          const arr = ownerRoughEstimatePercentArr;
          const idx = context.dataIndex;
          const percent = Array.isArray(arr) && idx < arr.length && typeof arr[idx] === 'number' ? arr[idx] : 0;
          return `${value} (${percent.toFixed(1)}%)`;
        },
        font: { weight: 'bold' as "bold", size: 14 },
        color: '#fff',
        clamp: true,
      },
    }],
  };
  const ownerRoughEstimateTableRows = Array.isArray(ownerRoughEstimateLabels) && Array.isArray(ownerRoughEstimateDataArr) && Array.isArray(ownerRoughEstimatePercentArr)
    ? ownerRoughEstimateLabels.map((label, idx) => ({
        label,
        sum: ownerRoughEstimateDataArr[idx],
        percent: ownerRoughEstimatePercentArr[idx],
      }))
    : [];

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
    <>
      {/* Page title and divider at the very top */}
      <Box sx={{ width: '100vw', pl: 4, pt: 3, pb: 1 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Analytics
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Box>
      {/* Filter below the title */}
      <Box sx={{ width: '100vw', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', pl: 4, pb: 1 }}>
        <FormControl size="small">
          <InputLabel id="analytics-filter-label">Filter</InputLabel>
          <Select
            labelId="analytics-filter-label"
            value={filter}
            label="Filter"
            onChange={e => setFilter(e.target.value as 'All' | 'InPlan')}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="InPlan">InPlan</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {/* Full-width Requirements by Customer chart outside the centered Stack */}
      <Box sx={{ width: '100vw', position: 'relative', left: '50%', right: '50%', ml: '-50vw', mr: '-50vw', px: 0, bgcolor: 'transparent', mb: 4 }}>
        <Card elevation={2} sx={{ borderRadius: 3, boxShadow: 1, width: '100%', m: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 3, pt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Requirements by Customer
            </Typography>
            <Select
              size="small"
              value={customerView}
              onChange={e => setCustomerView(e.target.value as 'chart' | 'table')}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="chart">Bar Chart</MenuItem>
              <MenuItem value="table">Table View</MenuItem>
            </Select>
          </Box>
          {/* 1. Show total # of requirements */}
          <Box sx={{ px: 3, pb: 1 }}>
            <Typography variant="subtitle1" color="text.secondary">
              Total Requirements: {totalRequirements}
            </Typography>
          </Box>
          {customerView === 'chart' ? (
            customerDataArr.length > 0 ? (
              <Box sx={{ width: '100%', height: 600, px: 3, pb: 3 }}>
                <Bar data={customerData} options={customerBarOptions} plugins={[ChartDataLabels]} />
              </Box>
            ) : (
              <Box sx={{ width: '100%', height: 600, px: 3, pb: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">No data to display</Typography>
              </Box>
            )
          ) : (
            <Box sx={{ mt: 2, px: 3, pb: 3 }}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer Name</TableCell>
                      <TableCell align="right" sx={{ cursor: 'pointer' }} onClick={() => {
                        if (customerSort === 'count') setCustomerSortOrder(customerSortOrder === 'desc' ? 'asc' : 'desc');
                        else { setCustomerSort('count'); setCustomerSortOrder('desc'); }
                      }}>
                        # Requirements {customerSort === 'count' ? (customerSortOrder === 'desc' ? '▼' : '▲') : ''}
                      </TableCell>
                      <TableCell align="right" sx={{ cursor: 'pointer' }} onClick={() => {
                        if (customerSort === 'percent') setCustomerSortOrder(customerSortOrder === 'desc' ? 'asc' : 'desc');
                        else { setCustomerSort('percent'); setCustomerSortOrder('desc'); }
                      }}>
                        % of Total {customerSort === 'percent' ? (customerSortOrder === 'desc' ? '▼' : '▲') : ''}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(customerTableRows) ? customerTableRows : []).map(row => (
                      <TableRow key={row.label}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">{typeof row.percent === 'number' && isFinite(row.percent) ? row.percent.toFixed(1) : '0.0'}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Card>
      </Box>
      {/* Rough Estimate by Customer chart */}
      <Box sx={{ width: '100vw', position: 'relative', left: '50%', right: '50%', ml: '-50vw', mr: '-50vw', px: 0, bgcolor: 'transparent', mb: 4 }}>
        <Card elevation={2} sx={{ borderRadius: 3, boxShadow: 1, width: '100%', m: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 3, pt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Rough Estimate by Customer
            </Typography>
            <Select
              size="small"
              value={roughEstimateView}
              onChange={e => setRoughEstimateView(e.target.value as 'chart' | 'table')}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="chart">Bar Chart</MenuItem>
              <MenuItem value="table">Table View</MenuItem>
            </Select>
          </Box>
          {/* 2. Show total rough estimate */}
          <Box sx={{ px: 3, pb: 1 }}>
            <Typography variant="subtitle1" color="text.secondary">
              Total Rough Estimate: {totalRoughEstimateAll}
            </Typography>
          </Box>
          {roughEstimateView === 'chart' ? (
            <Box sx={{ width: '100%', height: 600, px: 3, pb: 3 }}>
              <Bar data={roughEstimateData} options={roughEstimateBarOptions} plugins={[ChartDataLabels]} />
            </Box>
          ) : (
            <Box sx={{ mt: 2, px: 3, pb: 3 }}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer Name</TableCell>
                      <TableCell align="right">Rough Estimate</TableCell>
                      <TableCell align="right">% of Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(roughEstimateTableRows) ? roughEstimateTableRows : []).map(row => (
                      <TableRow key={row.label}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell align="right">{row.sum}</TableCell>
                        <TableCell align="right">{typeof row.percent === 'number' && isFinite(row.percent) ? row.percent.toFixed(1) : '0.0'}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Card>
      </Box>
      {/* Rest of analytics in centered Stack */}
      <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Analytics
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
          <Card elevation={2} sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom align="center">
              Requirements by Criteria
            </Typography>
            <Box sx={{ maxWidth: 600, mx: 'auto', width: '100%', height: 400 }}>
              <Bar data={criteriaData} options={verticalBarOptions} />
            </Box>
          </Card>
          <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
            <Typography variant="h6" gutterBottom align="center">
              Requirements by Status
            </Typography>
            <Box sx={{ height: 260 }}>
              {Object.keys(statusData.labels).length > 5 ? (
                <Bar data={statusData} options={verticalBarOptions} />
              ) : (
                <Pie data={statusData} options={pieChartOptions} />
              )}
            </Box>
          </Card>
          <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom align="center">
                Requirements by Score Range
              </Typography>
              <Select
                size="small"
                value={scoreRangeView}
                onChange={e => setScoreRangeView(e.target.value as 'chart' | 'table')}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="chart">Bar Chart</MenuItem>
                <MenuItem value="table">Table View</MenuItem>
              </Select>
            </Box>
            {scoreRangeView === 'chart' ? (
              <Box sx={{ maxWidth: 800, mx: 'auto', width: '100%', height: 400 }}>
                <Bar data={scoreRangeDataWithLabels} options={verticalBarOptions} />
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Score Range</TableCell>
                        <TableCell align="right"># Requirements</TableCell>
                        <TableCell align="right">% of Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(Array.isArray(scoreRangeTableRows) ? scoreRangeTableRows : []).map(row => (
                        <TableRow key={row.label}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell align="right">{row.count}</TableCell>
                          <TableCell align="right">{typeof row.percent === 'number' && isFinite(row.percent) ? row.percent.toFixed(1) : '0.0'}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Card>
          <Card elevation={2} sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom align="center">
              Requirements by Priority
            </Typography>
            <Box sx={{ height: 260 }}>
              <Bar data={priorityData} options={verticalBarOptions} />
            </Box>
          </Card>
          <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom align="center">
                Requirements by Product Owner
              </Typography>
              <Select
                size="small"
                value={ownerView}
                onChange={e => setOwnerView(e.target.value as 'chart' | 'table')}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="chart">Bar Chart</MenuItem>
                <MenuItem value="table">Table View</MenuItem>
              </Select>
            </Box>
            {ownerView === 'chart' ? (
              <Box sx={{ height: 260 }}>
                <Bar data={productOwnerDataWithLabels} options={horizontalBarOptions} />
              </Box>
            ) : (
              <Box sx={{ mt: 2 }}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product Owner</TableCell>
                        <TableCell align="right"># Requirements</TableCell>
                        <TableCell align="right">% of Requirements</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(Array.isArray(ownerTableRows) ? ownerTableRows : []).map(row => (
                        <TableRow key={row.label}>
                          <TableCell>{row.label}</TableCell>
                          <TableCell align="right">{row.count}</TableCell>
                          <TableCell align="right">{typeof row.percent === 'number' && isFinite(row.percent) ? row.percent.toFixed(1) : '0.0'}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Card>
          {/* 3. Rough Estimate by Product Owner report */}
          <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" gutterBottom align="center">
                Rough Estimate by Product Owner
              </Typography>
              {/* No chart/table toggle for now, but can add if needed */}
            </Box>
            <Box sx={{ height: 260 }}>
              <Bar data={ownerRoughEstimateData} options={horizontalBarOptions} plugins={[ChartDataLabels]} />
            </Box>
            <Box sx={{ mt: 2 }}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product Owner</TableCell>
                      <TableCell align="right">Rough Estimate</TableCell>
                      <TableCell align="right">% of Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(Array.isArray(ownerRoughEstimateTableRows) ? ownerRoughEstimateTableRows : []).map(row => (
                      <TableRow key={row.label}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell align="right">{row.sum}</TableCell>
                        <TableCell align="right">{typeof row.percent === 'number' && isFinite(row.percent) ? row.percent.toFixed(1) : '0.0'}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Card>
        </Box>
      </Stack>
    </>
  );
};

export default Analytics; 