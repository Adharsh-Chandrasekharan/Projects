import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../Button';
import PasswordInput from '../PasswordInput';
import RateEditor from '../RateEditor';
import { PlaystationType } from '../../types';
import { usePlaystations } from '../../hooks/usePlaystations';
import { confirmPassword } from '../../functions/confirmByPass';
import { DEFAULT_RATES } from '../../functions/rates';

interface AddModalProps {
  closeModal: () => void;
}

const AddModal: React.FC<AddModalProps> = ({ closeModal }) => {
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<PlaystationType>('PS5');
  const [rates, setRates] = useState(DEFAULT_RATES.PS5);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const { createPlaystation } = usePlaystations();

  useEffect(() => setRates(DEFAULT_RATES[selectedType].map((rate) => ({ ...rate }))), [selectedType]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Enter a name for this console.');
      return;
    }
    if (!(await confirmPassword(password))) {
      toast.error('Invalid admin password.');
      return;
    }
    setSaving(true);
    const result = await createPlaystation({ PlayStationName: name.trim(), PlayStationType: selectedType, rates });
    setSaving(false);
    if (!result.success) {
      toast.error(result.message || 'Could not add console.');
      return;
    }
    toast.success(`${name.trim()} added successfully.`);
    closeModal();
  };

  return (
    <div className="space-y-4 text-white">
      <div>
        <label className="mb-1.5 block text-sm text-neutral-300">Console name</label>
        <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: PS5 - TV 1" maxLength={100} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-sky-500" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-neutral-300">PlayStation type</label>
        <select value={selectedType} onChange={(event) => setSelectedType(event.target.value as PlaystationType)} className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 outline-none focus:border-sky-500">
          <option value="PS3">PlayStation 3</option>
          <option value="PS4">PlayStation 4</option>
          <option value="PS5">PlayStation 5</option>
        </select>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-neutral-200">Pricing setup</label>
          <span className="text-xs text-neutral-500">₹ INR · group total</span>
        </div>
        <RateEditor rates={rates} onChange={setRates} />
      </div>
      <div>
        <PasswordInput label="Confirm admin password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg bg-neutral-950 p-2 text-white" />
      </div>
      <Button type="button" disabled={saving} onClick={handleCreate} className="mt-1 bg-gradient-to-r from-sky-700 to-fuchsia-700 disabled:opacity-60">
        {saving ? 'Adding console…' : 'Add console'}
      </Button>
      {selectedType === 'PS3' && <p className="text-xs text-amber-300">No PS3 price was shown in the supplied rate card. Please enter the PS3 rates above before saving.</p>}
    </div>
  );
};

export default AddModal;
