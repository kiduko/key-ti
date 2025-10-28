import React, { useState } from 'react';
import { AWSProfile } from '../../types';
import { useProfile } from '../../hooks/useProfile';
import PageHeader from '../common/PageHeader';
import EmptyState from '../common/EmptyState';
import ProfileModal from '../modals/ProfileModal';

const SessionsTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AWSProfile | null>(null);

  const {
    profiles,
    otpAccounts,
    timeRemaining,
    activateProfile,
    deactivateProfile,
    deleteProfile,
    openConsole,
  } = useProfile();

  const handleAddProfile = () => {
    setEditingProfile(null);
    setIsModalOpen(true);
  };

  const handleEditProfile = (profile: AWSProfile) => {
    setEditingProfile(profile);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProfile(null);
  };

  return (
    <div className="section">
      <PageHeader
        title="프로필 목록"
        action={{ label: '+ 프로필 추가', onClick: handleAddProfile }}
      />

      <div className="profiles-list">
        {profiles.length === 0 ? (
          <EmptyState icon="📋" message="등록된 프로필이 없습니다" />
        ) : (
          profiles.map((profile) => (
            <div
              key={profile.alias}
              className={`profile-item ${profile.isActive ? 'active' : ''}`}
            >
              <div className="profile-info">
                <div className="profile-alias">{profile.alias}</div>
                <div className="profile-details">
                  {profile.profileName} | {profile.roleArn}
                  {profile.expiration && timeRemaining[profile.alias] && (
                    <>
                      {' '}| <span className={timeRemaining[profile.alias].className}>
                        {timeRemaining[profile.alias].text}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="profile-actions">
                {profile.isActive ? (
                  <>
                    <button
                      className="btn-success"
                      onClick={() => activateProfile(profile.alias)}
                    >
                      갱신
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => deactivateProfile(profile.alias)}
                    >
                      로그아웃
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => openConsole(profile.alias)}
                    >
                      콘솔
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => activateProfile(profile.alias)}
                  >
                    로그인
                  </button>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => handleEditProfile(profile)}
                >
                  수정
                </button>
                <button
                  className="btn-delete"
                  onClick={() => deleteProfile(profile.alias)}
                >
                  ✗
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <ProfileModal
          profile={editingProfile}
          otpAccounts={otpAccounts}
          onClose={handleCloseModal}
          onSave={handleCloseModal}
        />
      )}
    </div>
  );
};

export default SessionsTab;
