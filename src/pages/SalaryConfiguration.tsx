import { useState, useEffect } from 'react';
import { supabase, SalaryConfiguration } from '../lib/supabase';
import { Plus, Trash2, Save } from 'lucide-react';

export default function SalaryConfigurationPage() {
  const [config, setConfig] = useState<SalaryConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [baseSalary, setBaseSalary] = useState(15000);
  const [commissionPerPacket, setCommissionPerPacket] = useState(10);
  const [allowances, setAllowances] = useState<{ name: string; amount: number }[]>([]);
  const [targetLevels, setTargetLevels] = useState<{ levelName: string; targetPackets: number; incentiveAmount: number }[]>([]);
  const [newAllowanceName, setNewAllowanceName] = useState('');
  const [newAllowanceAmount, setNewAllowanceAmount] = useState(0);
  const [showAllowanceForm, setShowAllowanceForm] = useState(false);

  useEffect(() => {
    fetchConfiguration();
  }, []);

  const fetchConfiguration = async () => {
    try {
      const { data, error } = await supabase
        .from('salary_configurations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setBaseSalary(data.base_salary);
        setCommissionPerPacket(data.commission_per_packet);
        setAllowances(data.allowances || []);
        setTargetLevels(data.target_levels || []);
      }
    } catch (error) {
      console.error('Error fetching configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      const configData = {
        base_salary: baseSalary,
        commission_per_packet: commissionPerPacket,
        allowances,
        target_levels: targetLevels,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (config) {
        const { error } = await supabase
          .from('salary_configurations')
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('salary_configurations')
          .insert([configData]);

        if (error) throw error;
      }

      alert('Configuration saved successfully!');
      fetchConfiguration();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error saving configuration. Please try again.');
    }
  };

  const addAllowance = () => {
    if (newAllowanceName && newAllowanceAmount > 0) {
      setAllowances([...allowances, { name: newAllowanceName, amount: newAllowanceAmount }]);
      setNewAllowanceName('');
      setNewAllowanceAmount(0);
      setShowAllowanceForm(false);
    }
  };

  const removeAllowance = (index: number) => {
    setAllowances(allowances.filter((_, i) => i !== index));
  };

  const addTargetLevel = () => {
    setTargetLevels([
      ...targetLevels,
      { levelName: '', targetPackets: 0, incentiveAmount: 0 },
    ]);
  };

  const updateTargetLevel = (index: number, field: keyof typeof targetLevels[0], value: string | number) => {
    const updated = [...targetLevels];
    updated[index] = { ...updated[index], [field]: value };
    setTargetLevels(updated);
  };

  const removeTargetLevel = (index: number) => {
    setTargetLevels(targetLevels.filter((_, i) => i !== index));
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Salary Configuration</h1>
        <p className="text-gray-600">Configure salary structure and incentives</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Base Salary</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Allowances</h2>
            <button
              onClick={() => setShowAllowanceForm(!showAllowanceForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Allowance
            </button>
          </div>

          {showAllowanceForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Allowance name"
                  value={newAllowanceName}
                  onChange={(e) => setNewAllowanceName(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={newAllowanceAmount || ''}
                    onChange={(e) => setNewAllowanceAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={addAllowance}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {allowances.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No allowances added yet</p>
            ) : (
              allowances.map((allowance, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-800">{allowance.name}</span>
                    <span className="text-gray-600 ml-4">₹{allowance.amount}</span>
                  </div>
                  <button
                    onClick={() => removeAllowance(index)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Commission per Packet</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={commissionPerPacket}
                  onChange={(e) => setCommissionPerPacket(Number(e.target.value))}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Target Levels</h2>
            <button
              onClick={addTargetLevel}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Level
            </button>
          </div>

          <div className="space-y-4">
            {targetLevels.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No target levels defined yet</p>
            ) : (
              targetLevels.map((level, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                      type="text"
                      placeholder="Level name (e.g., Bronze)"
                      value={level.levelName}
                      onChange={(e) => updateTargetLevel(index, 'levelName', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Target packets"
                      value={level.targetPackets || ''}
                      onChange={(e) => updateTargetLevel(index, 'targetPackets', Number(e.target.value))}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        placeholder="Incentive amount"
                        value={level.incentiveAmount || ''}
                        onChange={(e) => updateTargetLevel(index, 'incentiveAmount', Number(e.target.value))}
                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => removeTargetLevel(index)}
                      className="text-red-600 hover:text-red-800 transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveConfiguration}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-lg font-medium"
          >
            <Save className="w-5 h-5" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
