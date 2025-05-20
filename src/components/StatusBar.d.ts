import * as React from 'react';

export interface StatusBarProps {
  scoredCount: number;
  rankedCount: number;
  totalCount: number;
  duplicateRanksCount: number;
  roughEstimateCount?: number;
  inPlanCount?: number;
  onDuplicateClick: () => void;
}

const StatusBar: React.FC<StatusBarProps>;
export default StatusBar; 