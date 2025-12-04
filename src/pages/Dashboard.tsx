import { useState, useEffect } from 'react';
import { supabase, CompanySettings, SalaryConfiguration } from '../lib/supabase';
import { Package, Users, TrendingUp, DollarSign, Edit2, Save, X, TrendingDown } from 'lucide-react';

interface DashboardStats {
  totalPacketsDelivered: number;
  totalPacketsPickuped: number;
  activeEmployees: number;
  revenue: number;
  totalEmployeeCost: number;
  totalExpenses: number;
  companyProfit: number;
  profitPercentage: number;
}

interface WeekStats {
  packets: number;
  pickups: number;
  revenue: number;
  profit: number;
  change?: number;
  changePercent?: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPacketsDelivered: 0,
    totalPacketsPickuped: 0,
    activeEmployees: 0,
    revenue: 0,
    totalEmployeeCost: 0,
    totalExpenses: 0,
    companyProfit: 0,
    profitPercentage: 0,
  });
  const [weekStats, setWeekStats] = useState({ current: null as WeekStats | null, previous: null as WeekStats | null });
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfit, setEditingProfit] = useState(false);
  const [profitPerPacket, setProfitPerPacket] = useState(50);
  const [profitPerPickup, setProfitPerPickup] = useState(0);

  useEffect(() => {
    fetchData();
  }, [currentMonth, currentYear]);

  const calculateSalary = (packets: number, config: SalaryConfiguration) => {
    const baseSalary = config.base_salary;
    const allowances = config.allowances.reduce((sum, a) => sum + a.amount, 0);
    const commission = packets * config.commission_per_packet;

    let achievementBonus = 0;
    const sortedLevels = [...config.target_levels].sort((a, b) => b.targetPackets - a.targetPackets);

    for (const level of sortedLevels) {
      if (packets >= level.targetPackets) {
        achievementBonus = level.incentiveAmount;
        break;
      }
    }

    return baseSalary + allowances + commission + achievementBonus;
  };

  const getWeekDates = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return {
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
    };
  };

  const fetchWeekStats = async (date: Date) => {
    const week = getWeekDates(date);
    const { data: deliveries } = await supabase
      .from('daily_deliveries')
      .select('*')
      .gte('delivery_date', week.start)
      .lte('delivery_date', week.end);

    let packets = 0;
    let pickups = 0;
    let revenue = 0;

    deliveries?.forEach((d) => {
      packets += d.packets_delivered;
      pickups += d.packets_pickuped || 0;
      revenue += d.revenue || 0;
    });

    return { packets, pickups, revenue, profit: revenue };
  };

  const fetchData = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      setCompanySettings(settings);
      setProfitPerPacket(settings?.profit_per_packet || 50);
      setProfitPerPickup(settings?.profit_per_packet_pickup || 0);

      const { data: config } = await supabase
        .from('salary_configurations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      setSalaryConfig(config);

      const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active');

      const startDate = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      const { data: deliveries } = await supabase
        .from('daily_deliveries')
        .select('*')
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);

      const { data: expenses } = await supabase
        .from('company_common_expenses')
        .select('amount')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      const totalPacketsDelivered = deliveries?.reduce((sum, d) => sum + d.packets_delivered, 0) || 0;
      const totalPacketsPickuped = deliveries?.reduce((sum, d) => sum + (d.packets_pickuped || 0), 0) || 0;
      
      // FIXED: Calculate revenue based on profit per packet settings
      const calculatedRevenue = (totalPacketsDelivered * profitPerPacket) + (totalPacketsPickuped * profitPerPickup);
      
      const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

      let totalEmployeeCost = 0;
      if (config && deliveries) {
        const employeePackets = new Map<string, number>();
        deliveries.forEach((d) => {
          const current = employeePackets.get(d.employee_id) || 0;
          employeePackets.set(d.employee_id, current + d.packets_delivered);
        });

        employees?.forEach((emp) => {
          const packets = employeePackets.get(emp.id) || 0;
          const salary = calculateSalary(packets, config);
          totalEmployeeCost += salary;
        });
      }

      // FIXED: Profit calculation
      const companyProfit = calculatedRevenue - totalExpenses - totalEmployeeCost;
      const profitPercentage = calculatedRevenue > 0 ? (companyProfit / calculatedRevenue) * 100 : 0;

      setStats({
        totalPacketsDelivered,
        totalPacketsPickuped,
        activeEmployees: employees?.length || 0,
        revenue: calculatedRevenue,
        totalEmployeeCost,
        totalExpenses,
        companyProfit,
        profitPercentage,
      });

      const today = new Date();
      const currentWeek = await fetchWeekStats(today);
      const previousDate = new Date(today);
      previousDate.setDate(previousDate.getDate() - 7);
      const previousWeek = await fetchWeekStats(previousDate);

      // FIXED: Weekly profit calculation using settings
      const currentWeekProfit = ((currentWeek.packets * profitPerPacket) + (currentWeek.pickups * profitPerPickup)) - totalExpenses;
      const previousWeekProfit = ((previousWeek.packets * profitPerPacket) + (previousWeek.pickups * profitPerPickup)) - totalExpenses;
      const profitChange = currentWeekProfit - previousWeekProfit;
      const changePercent = previousWeekProfit !== 0 ? (profitChange / previousWeekProfit) * 100 : 0;

      setWeekStats({
        current: { ...currentWeek, profit: currentWeekProfit },
        previous: { ...previousWeek, profit: previousWeekProfit, change: profitChange, changePercent },
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfitSettings = async () => {
    try {
      if (companySettings) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            profit_per_packet: profitPerPacket,
            profit_per_packet_pickup: profitPerPickup,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companySettings.id);

        if (error) throw error;
        setEditingProfit(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Error updating settings. Please try again.');
    }
  };

  const handleMonthChange = (month: number) => {
    if (month < 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else if (month > 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(month);
    }
  };

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });

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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
        <p className="text-gray-600">Overview of company performance</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Month View</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleMonthChange(currentMonth - 1)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-lg font-semibold text-gray-800 w-40 text-center">
              {monthName} {currentYear}
            </span>
            <button
              onClick={() => handleMonthChange(currentMonth + 1)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Packets Delivered</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPacketsDelivered}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Packets Pickuped</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPacketsPickuped}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Employees</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeEmployees}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Company Profit</p>
              <p className="text-3xl font-bold text-green-600">₹{stats.companyProfit.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Profit Calculation</h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-gray-700">Profit per Packet (Delivered):</span>
                {editingProfit ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={profitPerPacket}
                        onChange={(e) => setProfitPerPacket(Number(e.target.value))}
                        className="w-32 pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-gray-900">₹{profitPerPacket}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <span className="text-gray-700">Profit per Packet (Pickup):</span>
                {editingProfit ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number"
                      value={profitPerPickup}
                      onChange={(e) => setProfitPerPickup(Number(e.target.value))}
                      className="w-32 pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <span className="font-semibold text-gray-900">₹{profitPerPickup}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-700">Total Packets:</span>
              <span className="font-semibold text-gray-900">{stats.totalPacketsDelivered + stats.totalPacketsPickuped}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-700">Revenue:</span>
              <span className="font-semibold text-gray-900">₹{stats.revenue.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-700">Total Expenses:</span>
              <span className="font-semibold text-red-600">₹{stats.totalExpenses.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-700">Total Employee Cost:</span>
              <span className="font-semibold text-red-600">₹{stats.totalEmployeeCost.toLocaleString()}</span>
            </div>

            <div className="flex justify-between items-center py-4 bg-gray-50 rounded-lg px-4">
              <span className="text-lg font-bold text-gray-800">Company Profit:</span>
              <div className="text-right">
                <span className="text-2xl font-bold text-green-600">
                  ₹{stats.companyProfit.toLocaleString()}
                </span>
                <span className="block text-sm text-gray-600">
                  ({stats.profitPercentage.toFixed(2)}% margin)
                </span>
              </div>
            </div>

            {editingProfit ? (
              <div className="flex gap-2 justify-end pt-4">
                <button
                  onClick={() => {
                    setEditingProfit(false);
                    setProfitPerPacket(companySettings?.profit_per_packet || 50);
                    setProfitPerPickup(companySettings?.profit_per_packet_pickup || 0);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfitSettings}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            ) : (
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setEditingProfit(true)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Weekly Comparison</h2>

          {weekStats.current && weekStats.previous && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Current Week</p>
                  <p className="text-2xl font-bold text-blue-600">{weekStats.current.packets + weekStats.current.pickups}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Packets</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Previous Week</p>
                  <p className="text-2xl font-bold text-gray-600">{weekStats.previous.packets + weekStats.previous.pickups}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Packets</p>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Profit Change</p>
                    <p className="text-2xl font-bold text-green-600">₹{(weekStats.previous.change || 0).toLocaleString()}</p>
                  </div>
                  {(weekStats.previous.change || 0) >= 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="w-6 h-6" />
                      <span className="text-lg font-semibold">{(weekStats.previous.changePercent || 0).toFixed(1)}%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <TrendingDown className="w-6 h-6" />
                      <span className="text-lg font-semibold">{(weekStats.previous.changePercent || 0).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Current Week Revenue</p>
                  <p className="font-semibold text-gray-900">₹{((weekStats.current.packets * profitPerPacket) + (weekStats.current.pickups * profitPerPickup)).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">Previous Week Revenue</p>
                  <p className="font-semibold text-gray-900">₹{((weekStats.previous.packets * profitPerPacket) + (weekStats.previous.pickups * profitPerPickup)).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}