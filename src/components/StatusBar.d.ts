import * as React from 'react';

export interface StatusBarProps {
  scoredCount: number;
  rankedCount: number;
  totalCount: number;
  capacityString: string;
  roughEstimateCount?: number;
  roughEstimateTotal?: number;
  inPlanCount?: number;
  inPlanTotal?: number;
  onDuplicateClick: () => void;
}

const StatusBar: React.FC<StatusBarProps>;
export default StatusBar; 