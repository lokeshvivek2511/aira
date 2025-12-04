import { useState, useEffect } from 'react';
import { supabase, Employee, DailyDelivery, CompanySettings, CompanyCommonExpense } from '../lib/supabase';
import { Calendar, Save, Trash2, Plus, X } from 'lucide-react';

interface EmployeeEntry {
  employee: Employee;
  packets: number;
  pickups: number;
  existingEntry?: DailyDelivery;
}

export default function DailyEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<EmployeeEntry[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [expenses, setExpenses] = useState<CompanyCommonExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const { data: settings, error: settingsError } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (settingsError) throw settingsError;
      setCompanySettings(settings);

      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('name');

      if (empError) throw empError;

      const { data: deliveries, error: delError } = await supabase
        .from('daily_deliveries')
        .select('*')
        .eq('delivery_date', selectedDate);

      if (delError) throw delError;

      const entriesData: EmployeeEntry[] = (employees || []).map((emp) => {
        const existingEntry = deliveries?.find((d) => d.employee_id === emp.id);
        return {
          employee: emp,
          packets: existingEntry?.packets_delivered || 0,
          pickups: existingEntry?.packets_pickuped || 0,
          existingEntry,
        };
      });

      setEntries(entriesData);

      const { data: dailyExpenses, error: expenseError } = await supabase
        .from('company_common_expenses')
        .select('*')
        .eq('expense_date', selectedDate);

      if (expenseError) throw expenseError;

      setExpenses(dailyExpenses || []);
      const total = (dailyExpenses || []).reduce((sum, e) => sum + Number(e.amount), 0);
      setTotalExpenses(total);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePackets = (employeeId: string, packets: number) => {
    setEntries(
      entries.map((entry) =>
        entry.employee.id === employeeId ? { ...entry, packets: Math.max(0, packets) } : entry
      )
    );
  };

  const updatePickups = (employeeId: string, pickups: number) => {
    setEntries(
      entries.map((entry) =>
        entry.employee.id === employeeId ? { ...entry, pickups: Math.max(0, pickups) } : entry
      )
    );
  };

  const saveEntry = async (entry: EmployeeEntry) => {
    try {
      const profitPerPacket = companySettings?.profit_per_packet || 0;
      const profitPerPickup = companySettings?.profit_per_packet_pickup || 0;
      const revenue = entry.packets * profitPerPacket + entry.pickups * profitPerPickup;

      const payload = {
        packets_delivered: entry.packets,
        packets_pickuped: entry.pickups,
        revenue,
        updated_at: new Date().toISOString(),
        edited_at: new Date().toISOString(),
      };

      if (entry.existingEntry) {
        const { error } = await supabase
          .from('daily_deliveries')
          .update(payload)
          .eq('id', entry.existingEntry.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_deliveries')
          .insert([{
            employee_id: entry.employee.id,
            delivery_date: selectedDate,
            ...payload,
            status: 'completed',
          }]);

        if (error) throw error;
      }

      fetchData();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Error saving entry. Please try again.');
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const entry of entries) {
        if (entry.packets > 0 || entry.pickups > 0 || entry.existingEntry) {
          await saveEntry(entry);
        }
      }
      alert('All entries saved successfully!');
    } catch (error) {
      console.error('Error saving all entries:', error);
    } finally {
      setSaving(false);
    }
  };

  const addExpense = async () => {
    if (!expenseName || !expenseAmount) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('company_common_expenses')
        .insert([{
          expense_date: selectedDate,
          category: expenseName,
          amount: Number(expenseAmount),
        }]);

      if (error) throw error;

      setExpenseName('');
      setExpenseAmount('');
      setShowAddExpense(false);
      fetchData();
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Error adding expense. Please try again.');
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('company_common_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Error deleting expense. Please try again.');
    }
  };

  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Daily Entry</h1>
        <p className="text-gray-600">Record daily packet deliveries and pickups</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-gray-700 font-medium">
              <Calendar className="w-5 h-5" />
              Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={setToday}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Today
            </button>
          </div>

          <button
            onClick={saveAll}
            disabled={saving}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save All'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Profit per Packet (Delivered):</strong> ₹{companySettings?.profit_per_packet || 0} |
            <strong className="ml-4">Profit per Packet (Pickup):</strong> ₹{companySettings?.profit_per_packet_pickup || 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Daily Expenses</h2>
          <button
            onClick={() => setShowAddExpense(!showAddExpense)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>

        {showAddExpense && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg flex gap-3">
            <input
              type="text"
              placeholder="Expense name (e.g., Fuel, Maintenance)"
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                placeholder="Amount"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                className="w-32 pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={addExpense}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddExpense(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {expenses.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No expenses recorded for this date</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-gray-800">{expense.category}</span>
                  <span className="text-gray-600 ml-4">₹{Number(expense.amount).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold text-gray-800">
              <span>Total Expenses:</span>
              <span>₹{totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Packets Delivered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Packets Pickuped
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No active employees found
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.employee.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{entry.employee.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {entry.employee.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={entry.packets}
                        onChange={(e) => updatePackets(entry.employee.id, Number(e.target.value))}
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={entry.pickups}
                        onChange={(e) => updatePickups(entry.employee.id, Number(e.target.value))}
                        className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => saveEntry(entry)}
                        className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500">
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}
