import React, { useState, useEffect } from 'react';
import { MemoFile } from '../../types.js';
import { showToast } from '../ToastContainer.js';

const MemoTab: React.FC = () => {
  const [memos, setMemos] = useState<MemoFile[]>([]);
  const [currentMemoId, setCurrentMemoId] = useState<string | null>(null);
  const [memoName, setMemoName] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [isNewMemoModalOpen, setIsNewMemoModalOpen] = useState(false);
  const [newMemoName, setNewMemoName] = useState('');

  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = () => {
    const saved = localStorage.getItem('memos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMemos(parsed);
      } catch (error) {
        console.error('Failed to load memos:', error);
      }
    }
  };

  const saveMemos = (updatedMemos: MemoFile[]) => {
    localStorage.setItem('memos', JSON.stringify(updatedMemos));
    setMemos(updatedMemos);
  };

  const openMemo = (id: string) => {
    const memo = memos.find(m => m.id === id);
    if (memo) {
      setCurrentMemoId(id);
      setMemoName(memo.name);
      setMemoContent(memo.content);
    }
  };

  const handleNewMemo = () => {
    setNewMemoName(`메모 ${memos.length + 1}`);
    setIsNewMemoModalOpen(true);
  };

  const createNewMemo = () => {
    if (!newMemoName.trim()) return;

    const newMemo: MemoFile = {
      id: Date.now().toString(),
      name: newMemoName,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...memos, newMemo];
    saveMemos(updated);
    setIsNewMemoModalOpen(false);
    openMemo(newMemo.id);
    showToast('메모가 생성되었습니다', 'success');
  };

  const saveMemo = () => {
    if (!currentMemoId) return;

    const updated = memos.map(m => {
      if (m.id === currentMemoId) {
        return {
          ...m,
          name: memoName,
          content: memoContent,
          updatedAt: new Date().toISOString(),
        };
      }
      return m;
    });

    saveMemos(updated);
    showToast('메모가 저장되었습니다', 'success');
  };

  const deleteMemo = () => {
    if (!currentMemoId) return;
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    const updated = memos.filter(m => m.id !== currentMemoId);
    saveMemos(updated);
    setCurrentMemoId(null);
    setMemoName('');
    setMemoContent('');
    showToast('메모가 삭제되었습니다', 'success');
  };

  return (
    <div className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="section-title">메모장</h2>
        <button className="btn-primary" onClick={handleNewMemo}>
          + 새 메모
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - 200px)' }}>
        {/* 메모 파일 목록 */}
        <div style={{ width: '200px', borderRight: '1px solid #e0e0e0', paddingRight: '16px', overflowY: 'auto' }}>
          {memos.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '24px 0' }}>
              메모가 없습니다
            </div>
          ) : (
            memos.map(memo => (
              <div
                key={memo.id}
                className={`memo-file-item ${memo.id === currentMemoId ? 'active' : ''}`}
                onClick={() => openMemo(memo.id)}
                style={{ marginBottom: '8px' }}
              >
                {memo.name}
              </div>
            ))
          )}
        </div>

        {/* 메모 에디터 */}
        <div style={{ flex: 1 }}>
          {currentMemoId ? (
            <div>
              <input
                type="text"
                value={memoName}
                onChange={(e) => setMemoName(e.target.value)}
                placeholder="메모 제목"
                style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}
              />
              <textarea
                value={memoContent}
                onChange={(e) => setMemoContent(e.target.value)}
                placeholder="메모를 입력하세요..."
                style={{
                  width: '100%',
                  height: 'calc(100% - 100px)',
                  padding: '12px',
                  border: '1px solid #d0d0d0',
                  borderRadius: '8px',
                  fontFamily: "'Monaco', 'Menlo', monospace",
                  fontSize: '13px',
                  lineHeight: '1.5',
                  resize: 'none',
                }}
              />
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={deleteMemo}>
                  삭제
                </button>
                <button className="btn-primary" onClick={saveMemo}>
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '64px', color: '#999' }}>
              메모를 선택하거나 새로 만드세요
            </div>
          )}
        </div>
      </div>

      {/* 새 메모 모달 */}
      {isNewMemoModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <div className="modal-header">새 메모</div>
            <div className="form-group">
              <label>메모 이름</label>
              <input
                type="text"
                value={newMemoName}
                onChange={(e) => setNewMemoName(e.target.value)}
                placeholder="메모 제목"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsNewMemoModalOpen(false)}>
                취소
              </button>
              <button className="btn-primary" onClick={createNewMemo}>
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoTab;
