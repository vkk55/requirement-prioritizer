import React, { useState, useEffect } from "react";
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
} from "@mui/material";

interface Requirement {
  key: string;
  summary: string;
  [key: string]: any;
}

const AnalyticsPlus: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | "InPlan">("InPlan");

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

  const filteredRequirements =
    filter === "InPlan"
      ? requirements.filter(
          (r) => (r as any)["InPlan?"] === true || (r as any).inPlan === true
        )
      : requirements;

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", p: 3 }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Analytics+
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
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
      </Box>
      <Card sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Typography variant="h6">
            Total Requirements: {filteredRequirements.length}
          </Typography>
        )}
      </Card>
    </Box>
  );
};

export default AnalyticsPlus; 