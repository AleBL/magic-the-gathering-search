import { useTranslation } from 'react-i18next';
import BackupPanel from '../settings/BackupPanel';
import { ProfileMenuBackHeader } from './ProfileMenuBackHeader';

interface ProfileMenuBackupSectionProps {
  readonly onBack: () => void;
  readonly onClose: () => void;
}

export function ProfileMenuBackupSection({ onBack, onClose }: ProfileMenuBackupSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      <ProfileMenuBackHeader title={t('backup.title')} onBack={onBack} onClose={onClose} />
      <div className="profile-menu-divider" />
      <BackupPanel />
    </>
  );
}
