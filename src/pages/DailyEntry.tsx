import { useState, useEffect } from 'react';
import { supabase, Employee, DailyDelivery } from '../lib/supabase';
import { Calendar, Save } from 'lucide-react';

interface EmployeeEntry {
  employee: Employee;
  packets: number;
  existingEntry?: DailyDelivery;
}

export default function DailyEntry() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<EmployeeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
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
          existingEntry,
        };
      });

      setEntries(entriesData);
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

  const saveEntry = async (entry: EmployeeEntry) => {
    try {
      if (entry.existingEntry) {
        const { error } = await supabase
          .from('daily_deliveries')
          .update({
            packets_delivered: entry.packets,
            updated_at: new Date().toISOString(),
            edited_at: new Date().toISOString(),
          })
          .eq('id', entry.existingEntry.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_deliveries')
          .insert([{
            employee_id: entry.employee.id,
            delivery_date: selectedDate,
            packets_delivered: entry.packets,
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
        if (entry.packets > 0 || entry.existingEntry) {
          await saveEntry(entry);
        }
      }
      alert('All entries saved successfully!');
    } catch (error) {
      console.error('Error saving all entries:', error);
      alert('Error saving entries. Please try again.');
    } finally {
      setSaving(false);
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
        <p className="text-gray-600">Record daily packet deliveries</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
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
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
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
