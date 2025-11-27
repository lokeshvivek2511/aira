import { useState, useEffect } from 'react';
import { supabase, CompanySettings, SalaryConfiguration } from '../lib/supabase';
import { Package, Users, TrendingUp, DollarSign, Edit2, Save, X } from 'lucide-react';

interface DashboardStats {
  totalPacketsToday: number;
  totalPacketsMonth: number;
  activeEmployees: number;
  revenue: number;
  totalEmployeeCost: number;
  companyProfit: number;
  profitPercentage: number;
}

interface TopPerformer {
  name: string;
  packets: number;
  salary: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPacketsToday: 0,
    totalPacketsMonth: 0,
    activeEmployees: 0,
    revenue: 0,
    totalEmployeeCost: 0,
    companyProfit: 0,
    profitPercentage: 0,
  });
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [salaryConfig, setSalaryConfig] = useState<SalaryConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfit, setEditingProfit] = useState(false);
  const [profitPerPacket, setProfitPerPacket] = useState(50);

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (settingsError) throw settingsError;
      setCompanySettings(settings);
      setProfitPerPacket(settings?.profit_per_packet || 50);

      const { data: config, error: configError } = await supabase
        .from('salary_configurations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (configError) throw configError;
      setSalaryConfig(config);

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active');

      if (empError) throw empError;

      const today = new Date().toISOString().split('T')[0];
      const { data: todayDeliveries, error: todayError } = await supabase
        .from('daily_deliveries')
        .select('*')
        .eq('delivery_date', today);

      if (todayError) throw todayError;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      const { data: monthDeliveries, error: monthError } = await supabase
        .from('daily_deliveries')
        .select('*')
        .gte('delivery_date', startDate)
        .lte('delivery_date', endDate);

      if (monthError) throw monthError;

      const totalPacketsToday = todayDeliveries?.reduce((sum, d) => sum + d.packets_delivered, 0) || 0;
      const totalPacketsMonth = monthDeliveries?.reduce((sum, d) => sum + d.packets_delivered, 0) || 0;

      const employeePackets = new Map<string, number>();
      monthDeliveries?.forEach((delivery) => {
        const current = employeePackets.get(delivery.employee_id) || 0;
        employeePackets.set(delivery.employee_id, current + delivery.packets_delivered);
      });

      let totalEmployeeCost = 0;
      const performers: TopPerformer[] = [];

      if (config) {
        employees?.forEach((emp) => {
          const packets = employeePackets.get(emp.id) || 0;
          const salary = calculateSalary(packets, config);
          totalEmployeeCost += salary;

          if (packets > 0) {
            performers.push({
              name: emp.name,
              packets,
              salary,
            });
          }
        });
      }

      performers.sort((a, b) => b.packets - a.packets);
      setTopPerformers(performers.slice(0, 10));

      const revenue = totalPacketsMonth * (settings?.profit_per_packet || 50);
      const companyProfit = revenue - totalEmployeeCost;
      const profitPercentage = revenue > 0 ? (companyProfit / revenue) * 100 : 0;

      setStats({
        totalPacketsToday,
        totalPacketsMonth,
        activeEmployees: employees?.length || 0,
        revenue,
        totalEmployeeCost,
        companyProfit,
        profitPercentage,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfitPerPacket = async () => {
    try {
      if (companySettings) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            profit_per_packet: profitPerPacket,
            updated_at: new Date().toISOString(),
          })
          .eq('id', companySettings.id);

        if (error) throw error;
        setEditingProfit(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error updating profit per packet:', error);
      alert('Error updating profit per packet. Please try again.');
    }
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Today's Packets</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPacketsToday}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Month's Packets</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalPacketsMonth}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
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

      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Profit Calculation</h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <span className="text-gray-700">Profit per Packet:</span>
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
                  <button
                    onClick={saveProfitPerPacket}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingProfit(false);
                      setProfitPerPacket(companySettings?.profit_per_packet || 50);
                    }}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">₹{profitPerPacket}</span>
                  <button
                    onClick={() => setEditingProfit(true)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-gray-700">Total Packets (Month):</span>
            <span className="font-semibold text-gray-900">{stats.totalPacketsMonth}</span>
          </div>

          <div className="flex justify-between items-center py-3 border-b border-gray-200">
            <span className="text-gray-700">Revenue:</span>
            <span className="font-semibold text-gray-900">
              ₹{stats.revenue.toLocaleString()}
            </span>
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
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Top Performers (This Month)</h2>

        {topPerformers.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No delivery data available yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Packets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Salary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topPerformers.map((performer, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{performer.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{performer.packets}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-green-600">
                        ₹{performer.salary.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
