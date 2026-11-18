import { useState } from 'react';
import Modal from '../Modal/Modal';
import AddModal from '../Modal/AddModal';
import { BsPlaystation } from 'react-icons/bs';
import { AiOutlinePlus } from 'react-icons/ai';
import PsListItem from './PsListItem';
import { usePlaystations } from '../../hooks/usePlaystations';

const Library: React.FC = () => {
  const { playstations } = usePlaystations();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="inline-flex items-center gap-x-2">
          <BsPlaystation className="text-neutral-400" size={25} />
          <p className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Your PlayStations</p>
        </div>
        <button type="button" onClick={() => setIsModalOpen(true)} aria-label="Add console" className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white">
          <AiOutlinePlus size={20} />
        </button>
      </div>
      <div className="flex flex-col gap-y-1 px-2 pb-3">
        {playstations.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-500">No consoles added yet.</p>
        ) : playstations.map((ps) => <PsListItem key={ps.PlayStationID} ps={ps} />)}
      </div>
      <Modal title="Add a PlayStation" description="Name the console and set its rates for each player count." isOpen={isModalOpen} onChange={setIsModalOpen}>
        <AddModal closeModal={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
};

export default Library;
