import { ReactNode } from 'react';
import { FaChevronDown, FaTimes } from 'react-icons/fa';

interface ProfileMenuBackHeaderProps {
  readonly title: ReactNode;
  readonly onBack: () => void;
  readonly onClose: () => void;
}

/** The "‹ Title  ✕" header shared by every non-main section of the profile menu. */
export function ProfileMenuBackHeader({ title, onBack, onClose }: ProfileMenuBackHeaderProps) {
  return (
    <div className="profile-menu-back-header">
      <button type="button" onClick={onBack} className="profile-back-btn">
        <FaChevronDown className="rotate-90 text-xs" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">{title}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded"
      >
        <FaTimes className="text-xs" />
      </button>
    </div>
  );
}

export default ProfileMenuBackHeader;
