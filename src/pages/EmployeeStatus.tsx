import { useState, useEffect } from 'react';
import { supabase, Employee, SalaryConfiguration, CompanySettings } from '../lib/supabase';
import { User, TrendingUp, Award, X, Download } from 'lucide-react';
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

interface ReportModalProps {
  employees: Employee[];
  salaryConfig: SalaryConfiguration | null;
  companySettings: CompanySettings | null;
  onClose: () => void;
}

function ReportModal({ employees, salaryConfig, companySettings, onClose }: ReportModalProps) {
  const [reportMode, setReportMode] = useState<'month' | 'week' | 'range'>('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weekStartDate, setWeekStartDate] = useState('');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [generating, setGenerating] = useState(false);

  const generateReport = async () => {
    setGenerating(true);
    try {
      let fromDate: string;
      let toDate: string;
      let filename: string;

      if (reportMode === 'month') {
        fromDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
        toDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
        const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' });
        filename = `${monthName}_${selectedYear}_report.xlsx`;
      } else if (reportMode === 'week') {
        const date = new Date(weekStartDate);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(date.setDate(diff));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        fromDate = weekStart.toISOString().split('T')[0];
        toDate = weekEnd.toISOString().split('T')[0];
        filename = `Week_${fromDate}_to_${toDate}_report.xlsx`;
      } else {
        fromDate = customFromDate;
        toDate = customToDate;
        filename = `Report_${fromDate}_to_${toDate}.xlsx`;
      }

      const { data: deliveries } = await supabase
        .from('daily_deliveries')
        .select('*')
        .gte('delivery_date', fromDate)
        .lte('delivery_date', toDate);

      const dateList: string[] = [];
      for (let d = new Date(fromDate); d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
        dateList.push(new Date(d).toISOString().split('T')[0]);
      }

      // FIXED: Updated header to include profit-based calculations
      const header = ['Date'];
      employees.forEach((e) => {
        header.push(`${e.name} - Delivered`);
        header.push(`${e.name} - Pickuped`);
        header.push(`${e.name} - Profit`);
      });
      header.push('Total Profit');

      const rows: (string | number)[][] = [header];

      // FIXED: Map now stores delivered, pickuped separately for profit calculation
      const map = new Map<string, { delivered: number; pickuped: number }>();
      deliveries?.forEach((d) => {
        const key = `${d.delivery_date}|${d.employee_id}`;
        map.set(key, {
          delivered: d.packets_delivered,
          pickuped: d.packets_pickuped || 0,
        });
      });

      dateList.forEach((date) => {
        const row: (string | number)[] = [date];
        let dailyTotal = 0;
        employees.forEach((e) => {
          const key = `${date}|${e.id}`;
          const rec = map.get(key) ?? { delivered: 0, pickuped: 0 };
          
          // FIXED: Calculate profit using settings
          const profit = (rec.delivered * companySettings.profit_per_packet) + (rec.pickuped * companySettings.profit_per_packet_pickup);
          
          row.push(rec.delivered);
          row.push(rec.pickuped);
          row.push(profit);
          dailyTotal += profit;
        });
        row.push(dailyTotal);
        rows.push(row);
      });

      const totalsRow: (string | number)[] = ['Total'];
      let grandTotal = 0;
      for (let i = 0; i < employees.length; i++) {
        let deliveredSum = 0;
        let pickupSum = 0;
        let profitSum = 0;

        rows.slice(1).forEach((r) => {
          const colIndex = 1 + i * 3;
          deliveredSum += Number(r[colIndex] || 0);
          pickupSum += Number(r[colIndex + 1] || 0);
          
          // FIXED: Calculate profit sum using settings
          const profit = (Number(r[colIndex] || 0) * companySettings.profit_per_packet) + (Number(r[colIndex + 1] || 0) * companySettings.profit_per_packet_pickup);
          profitSum += profit;
        });

        totalsRow.push(deliveredSum);
        totalsRow.push(pickupSum);
        totalsRow.push(profitSum);
        grandTotal += profitSum;
      }
      totalsRow.push(grandTotal);
      rows.push(totalsRow);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, filename);

      alert('Report generated successfully!');
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const isValid = () => {
    if (reportMode === 'month') return true;
    if (reportMode === 'week') return weekStartDate !== '';
    return customFromDate !== '' && customToDate !== '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Generate Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4">
            {['month', 'week', 'range'].map((mode) => (
              <label key={mode} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reportMode"
                  value={mode}
                  checked={reportMode === mode}
                  onChange={(e) => setReportMode(e.target.value as 'month' | 'week' | 'range')}
                  className="w-4 h-4"
                />
                <span className="text-gray-700 capitalize">{mode === 'range' ? 'Custom Range' : `Whole ${mode}`}</span>
              </label>
            ))}
          </div>

          {reportMode === 'month' && (
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
                />
              </div>
            </div>
          )}

          {reportMode === 'week' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Week Start Date</label>
              <input
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {reportMode === 'range' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              This report will include columns for each employee with Delivered, Pickuped, and Profit data. A totals row will be added at the bottom.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generateReport}
              disabled={!isValid() || generating}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {generating ? 'Generating...' : 'Download Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function EmployeeStatus() {
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfiguration | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStats | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'packets' | 'salary' | 'name'>('packets');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

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
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      setCompanySettings(settings);

      const { data: config } = await supabase
        .from('salary_configurations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (!config) {
        console.error('No active salary configuration found');
        return;
      }

      setSalaryConfig(config);

      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (!employees) return;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      const { data: deliveries } = await supabase
        .from('daily_deliveries')
        .select('*')
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);

      const stats: EmployeeStats[] = employees.map((emp) => {
        const empDeliveries = deliveries?.filter((d) => d.employee_id === emp.id) || [];
        const totalPackets = empDeliveries.reduce((sum, d) => sum + d.packets_delivered, 0);

        const salaryCalc = calculateSalary(totalPackets, config);

        const sortedLevels = [...config.target_levels].sort((a, b) => a.targetPackets - b.targetPackets);
        const currentLevelIndex = sortedLevels.findIndex((l) => l.levelName === salaryCalc.achievementLevel);
        const nextLevel = currentLevelIndex < sortedLevels.length - 1 ? sortedLevels[currentLevelIndex + 1] : null;

        const progress = nextLevel
          ? Math.min((totalPackets / nextLevel.targetPackets) * 100, 100)
          : salaryCalc.achievementLevel !== 'None'
            ? 100
            : 0;

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
          nextLevel: nextLevel
            ? {
                name: nextLevel.levelName,
                remaining: nextLevel.targetPackets - totalPackets,
              }
            : undefined,
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Employee Status</h1>
        <p className="text-gray-600">Track performance and salary breakdown</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
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
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
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

      {showReportModal && salaryConfig && (
        <ReportModal
          employees={employeeStats.map((s) => s.employee)}
          salaryConfig={salaryConfig}
          companySettings={companySettings}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
