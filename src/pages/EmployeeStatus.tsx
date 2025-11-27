import { useState, useEffect } from 'react';
import { supabase, Employee, SalaryConfiguration } from '../lib/supabase';
import { User, TrendingUp, Award, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface EmployeeStats {
  employee: Employee;
  totalPackets: number;
  achievementLevel: string;
  salary: {
    baseSalary: number;
    allowances: number;
    commission: number;
    achievementBonus: number;
    totalSalary: number;
  };
  progress: number;
  nextLevel?: { name: string; remaining: number };
}

interface SalaryBreakdownModalProps {
  stats: EmployeeStats;
  salaryConfig: SalaryConfiguration;
  onClose: () => void;
}

function SalaryBreakdownModal({ stats, salaryConfig, onClose }: SalaryBreakdownModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Salary Breakdown</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-700">Base Salary</span>
            <span className="font-semibold text-gray-900">₹{stats.salary.baseSalary.toLocaleString()}</span>
          </div>

          {stats.salary.allowances > 0 && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-gray-700">Allowances</span>
                <span className="font-semibold text-gray-900">₹{stats.salary.allowances.toLocaleString()}</span>
              </div>
              <div className="pl-4 space-y-1">
                {salaryConfig.allowances.map((allowance, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-gray-600">
                    <span>- {allowance.name}</span>
                    <span>₹{allowance.amount}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-700">Commission ({stats.totalPackets} packets × ₹{salaryConfig.commission_per_packet})</span>
            <span className="font-semibold text-gray-900">₹{stats.salary.commission.toLocaleString()}</span>
          </div>

          {stats.salary.achievementBonus > 0 && (
            <div className="flex justify-between items-center py-2 border-b border-gray-200">
              <span className="text-gray-700">Achievement Bonus ({stats.achievementLevel})</span>
              <span className="font-semibold text-green-600">₹{stats.salary.achievementBonus.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between items-center py-3 border-t-2 border-gray-300 mt-4">
            <span className="text-lg font-bold text-gray-800">Total Salary</span>
            <span className="text-2xl font-bold text-blue-600">₹{stats.salary.totalSalary.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeStatus() {
  // All hooks at the top level
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'packets' | 'salary' | 'name'>('packets');
  const [searchTerm, setSearchTerm] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMonth, setReportMonth] = useState('');
  const [reportYear, setReportYear] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to fetch stats for selected month/year
  const fetchStatsForMonthYear = async (month: number, year: number) => {
    try {
      const { data: config, error: configError } = await supabase
        .from('salary_configurations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (configError || !config) return [];

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (empError || !employees) return [];

      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const { data: deliveries, error: delError } = await supabase
        .from('daily_deliveries')
        .select('*')
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);
      if (delError || !deliveries) return [];

      return employees.map((emp: any) => {
        const empDeliveries = deliveries.filter((d: any) => d.employee_id === emp.id);
        const totalPackets = empDeliveries.reduce((sum: number, d: any) => sum + d.packets_delivered, 0);
        const salaryCalc = calculateSalary(totalPackets, config);

        // Find target for this employee if available
        let target = '';
        if (config.target_levels && Array.isArray(config.target_levels)) {
          const level = config.target_levels.find((lvl: any) => lvl.levelName === salaryCalc.achievementLevel);
          target = level ? level.targetPackets : '';
        }

        return {
          name: emp.name,
          parcels: totalPackets,
          target: target,
          achievementLevel: salaryCalc.achievementLevel,
          baseSalary: salaryCalc.baseSalary,
          petrol: salaryCalc.allowances,
          commission: salaryCalc.commission,
          incentive: salaryCalc.achievementBonus,
          totalSalary: salaryCalc.totalSalary,
        };
      });
    } catch (err) {
      console.error('Error generating report:', err);
      return [];
    }
  };

  const handleDownloadReport = () => {
    setShowReportModal(true);
  };

  const handleGenerateReport = async () => {
    if (!reportMonth || !reportYear) return;
    setReportLoading(true);
    const stats = await fetchStatsForMonthYear(Number(reportMonth), Number(reportYear));
    const wsData = [
      [
        'Name',
        'Parcels',
        'Target',
        'Achievement level',
        'Base Salary',
        'Petrol',
        'Commission',
        'Incentive',
        'Total Salary',
      ],
      ...stats.map(emp => [
        emp.name,
        emp.parcels,
        emp.target,
        emp.achievementLevel,
        emp.baseSalary,
        emp.petrol,
        emp.commission,
        emp.incentive,
        emp.totalSalary,
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salary Report');
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const fileName = `${monthNames[Number(reportMonth) - 1]}-${reportYear}-salary report.xlsx`;
    XLSX.writeFile(wb, fileName);
    setReportLoading(false);
    setShowReportModal(false);
    setReportMonth('');
    setReportYear('');
  };

  const calculateSalary = (packets: number, config: SalaryConfiguration) => {
    const baseSalary = config.base_salary;
    const allowances = config.allowances.reduce((sum, a) => sum + a.amount, 0);
    const commission = packets * config.commission_per_packet;

    let achievementBonus = 0;
    let achievementLevel = 'None';

    const sortedLevels = [...config.target_levels].sort((a, b) => b.targetPackets - a.targetPackets);

    for (const level of sortedLevels) {
      if (packets >= level.targetPackets) {
        achievementBonus = level.incentiveAmount;
        achievementLevel = level.levelName;
        break;
      }
    }

    return {
      baseSalary,
      allowances,
      commission,
      achievementBonus,
      totalSalary: baseSalary + allowances + commission + achievementBonus,
      achievementLevel,
    };
  };

  const fetchData = async () => {
    try {
      const { data: config, error: configError } = await supabase
        .from('salary_configurations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (configError) throw configError;
      if (!config) {
        console.error('No active salary configuration found');
        return;
      }

      setSalaryConfig(config);

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (empError) throw empError;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      const { data: deliveries, error: delError } = await supabase
        .from('daily_deliveries')
        .select('*')
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);

      if (delError) throw delError;

      const stats: EmployeeStats[] = (employees || []).map((emp) => {
        const empDeliveries = deliveries?.filter((d) => d.employee_id === emp.id) || [];
        const totalPackets = empDeliveries.reduce((sum, d) => sum + d.packets_delivered, 0);

        const salaryCalc = calculateSalary(totalPackets, config);

        const sortedLevels = [...config.target_levels].sort((a, b) => a.targetPackets - b.targetPackets);
        const currentLevelIndex = sortedLevels.findIndex(l => l.levelName === salaryCalc.achievementLevel);
        const nextLevel = currentLevelIndex < sortedLevels.length - 1 ? sortedLevels[currentLevelIndex + 1] : null;

        const progress = nextLevel
          ? Math.min((totalPackets / nextLevel.targetPackets) * 100, 100)
          : salaryCalc.achievementLevel !== 'None' ? 100 : 0;

        return {
          employee: emp,
          totalPackets,
          achievementLevel: salaryCalc.achievementLevel,
          salary: {
            baseSalary: salaryCalc.baseSalary,
            allowances: salaryCalc.allowances,
            commission: salaryCalc.commission,
            achievementBonus: salaryCalc.achievementBonus,
            totalSalary: salaryCalc.totalSalary,
          },
          progress,
          nextLevel: nextLevel ? {
            name: nextLevel.levelName,
            remaining: nextLevel.targetPackets - totalPackets,
          } : undefined,
        };
      });

      setEmployeeStats(stats);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedStats = employeeStats
    .filter((stat) => {
      const matchesSearch = stat.employee.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = filterLevel === 'all' || stat.achievementLevel === filterLevel;
      return matchesSearch && matchesLevel;
    })
    .sort((a, b) => {
      if (sortBy === 'packets') return b.totalPackets - a.totalPackets;
      if (sortBy === 'salary') return b.salary.totalSalary - a.salary.totalSalary;
      return a.employee.name.localeCompare(b.employee.name);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Download Report Button */}
      <div className="mb-4 flex justify-end">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700"
          onClick={handleDownloadReport}
        >
          Download Report
        </button>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Select Month and Year</h2>
            <div className="mb-4">
              <select
                className="w-full mb-2 px-3 py-2 border rounded"
                value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
              >
                <option value="">Month</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                className="w-full px-3 py-2 border rounded"
                value={reportYear}
                onChange={e => setReportYear(e.target.value)}
              >
                <option value="">Year</option>
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex-1"
                onClick={handleGenerateReport}
                disabled={!reportMonth || !reportYear || reportLoading}
              >
                {reportLoading ? 'Generating...' : 'Generate & Download'}
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg flex-1"
                onClick={() => setShowReportModal(false)}
                disabled={reportLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Employee Status</h1>
        <p className="text-gray-600">Track performance and salary breakdown</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Levels</option>
            {salaryConfig?.target_levels.map((level) => (
              <option key={level.levelName} value={level.levelName}>
                {level.levelName}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'packets' | 'salary' | 'name')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="packets">Sort by Packets</option>
            <option value="salary">Sort by Salary</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAndSortedStats.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No employees found
          </div>
        ) : (
          filteredAndSortedStats.map((stat) => (
            <div
              key={stat.employee.id}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedEmployee(stat)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-3 rounded-full">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg">{stat.employee.name}</h3>
                    <p className="text-sm text-gray-500">{stat.employee.email}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Packets</span>
                  </div>
                  <span className="font-bold text-gray-900">{stat.totalPackets}</span>
                </div>

                {stat.achievementLevel !== 'None' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-gray-600">Achievement</span>
                    </div>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      {stat.achievementLevel}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{stat.progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${stat.progress}%` }}
                    />
                  </div>
                  {stat.nextLevel && (
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.nextLevel.remaining} packets to {stat.nextLevel.name}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Salary</span>
                    <span className="text-2xl font-bold text-green-600">
                      ₹{stat.salary.totalSalary.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedEmployee && salaryConfig && (
        <SalaryBreakdownModal
          stats={selectedEmployee}
          salaryConfig={salaryConfig}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}