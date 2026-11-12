import { IoMdClose } from 'react-icons/io';
import * as Dialog from '@radix-ui/react-dialog';

interface ModalProps {
  isOpen?: boolean;
  onChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onChange, title, description, children }) => (
  <Dialog.Root open={isOpen} onOpenChange={onChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[94vw] max-w-[650px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl focus:outline-none">
        <Dialog.Title className="mb-2 text-center text-xl font-bold text-white">{title}</Dialog.Title>
        {description && <Dialog.Description className="mb-5 text-center text-sm leading-normal text-neutral-400">{description}</Dialog.Description>}
        <div>{children}</div>
        <Dialog.Close asChild>
          <button type="button" aria-label="Close dialog" className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-white">
            <IoMdClose className="h-5 w-5" />
          </button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Modal;
