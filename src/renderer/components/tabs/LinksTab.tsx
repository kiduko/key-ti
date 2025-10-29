import React, { useState, useEffect } from 'react';
import { Link } from '../../types.js';
import { showToast } from '../ToastContainer.js';

const LinksTab: React.FC = () => {
  const [links, setLinks] = useState<Link[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = () => {
    const saved = localStorage.getItem('links');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setLinks(parsed);
      } catch (error) {
        console.error('Failed to load links:', error);
      }
    }
  };

  const saveLinks = (updatedLinks: Link[]) => {
    localStorage.setItem('links', JSON.stringify(updatedLinks));
    setLinks(updatedLinks);
  };

  const handleAddLink = () => {
    setLinkName('');
    setLinkUrl('');
    setIsModalOpen(true);
  };

  const handleSaveLink = () => {
    if (!linkName.trim() || !linkUrl.trim()) {
      showToast('이름과 URL을 모두 입력하세요', 'error');
      return;
    }

    const newLink: Link = {
      name: linkName,
      url: linkUrl,
    };

    const updated = [...links, newLink];
    saveLinks(updated);
    setIsModalOpen(false);
    showToast('링크가 추가되었습니다', 'success');
  };

  const handleDeleteLink = (index: number) => {
    if (!confirm('이 링크를 삭제하시겠습니까?')) return;

    const updated = links.filter((_, i) => i !== index);
    saveLinks(updated);
    showToast('링크가 삭제되었습니다', 'success');
  };

  const handleOpenLink = async (url: string) => {
    try {
      await window.electronAPI.openUrl(url);
    } catch (error) {
      showToast('링크 열기 실패', 'error');
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">자주 사용하는 링크</h2>

      <div className="links-list">
        {links.map((link, index) => (
          <div key={index} className="link-item" onClick={() => handleOpenLink(link.url)}>
            <div className="link-name">{link.name}</div>
            <div className="link-url">{link.url}</div>
            <div className="link-delete">
              <button
                className="btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteLink(index);
                }}
              >
                ✗
              </button>
            </div>
          </div>
        ))}

        <div className="add-link-btn" onClick={handleAddLink}>
          + 링크 추가
        </div>
      </div>

      {/* 링크 추가 모달 */}
      {isModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">링크 추가</div>
            <div className="form-group">
              <label>링크 이름</label>
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="예: AWS Console"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>URL</label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={handleSaveLink}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinksTab;
