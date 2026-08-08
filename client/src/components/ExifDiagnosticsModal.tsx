import React, { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, CalendarClock } from 'lucide-react';
import axios from 'axios';
import { ExifDiagnosticResult } from '../types';

interface ExifDiagnosticsModalProps {
  onClose: () => void;
}

export const ExifDiagnosticsModal: React.FC<ExifDiagnosticsModalProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ExifDiagnosticResult[]>([]);
  const [search, setSearch] = useState('');

  const [statusMessage, setStatusMessage] = useState('Initializing stream...');
  const [checkedCount, setCheckedCount] = useState(0);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [eventSourceRef, setEventSourceRef] = useState<EventSource | null>(null);

  useEffect(() => {
    fetchDiagnosticsStream(1);
    return () => {
      // Clean up the stream if component unmounts
      if (eventSourceRef) {
        eventSourceRef.close();
      }
    };
  }, []);

  const fetchDiagnosticsStream = (startPage: number = 1) => {
    if (startPage === 1) {
      setResults([]);
      setCheckedCount(0);
    }
    setLoading(true);
    setNextPage(null);
    
    // Default limit is 999999 so it runs until stopped or finished
    const eventSource = new EventSource(`/api/exif/diagnostics/stream?startPage=${startPage}&limit=999999`);
    setEventSourceRef(eventSource);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          if (data.message) setStatusMessage(data.message);
          if (data.checked !== undefined) setCheckedCount(data.checked);
        } else if (data.type === 'mismatch') {
          setResults(prev => {
            // filter out duplicates just in case
            const newItems = data.items.filter((item: any) => !prev.some(p => p.assetId === item.assetId));
            return [...prev, ...newItems];
          });
        } else if (data.type === 'done') {
          setLoading(false);
          eventSource.close();
        } else if (data.type === 'stopped') {
          setLoading(false);
          setNextPage(data.next_page);
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('EXIF stream error:', data.error);
          setStatusMessage(`Error: ${data.error}`);
          setLoading(false);
          eventSource.close();
        }
      } catch (e) {
        console.error('SSE parse error', e);
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setStatusMessage('Connection lost or stopped.');
      setLoading(false);
      eventSource.close();
    };
  };

  const stopScan = () => {
    if (eventSourceRef) {
      eventSourceRef.close();
      setLoading(false);
      setStatusMessage('Scan manually stopped.');
    }
  };

  const filteredResults = results.filter(r => 
    r.originalFileName.toLowerCase().includes(search.toLowerCase()) || 
    r.albumNames.some(a => a.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ maxWidth: '95vw', width: '100%', height: '95vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CalendarClock size={28} color="#eab308" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>EXIF Date Diagnostics</h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Scanning your library for manually edited or missing dates
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexShrink: 0, justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search filename or album..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '40px', width: '100%' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {loading && (
              <button className="btn-secondary" onClick={stopScan} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                Stop Scan
              </button>
            )}
            <div style={{ color: 'var(--text-muted)' }}>
              Found <strong style={{ color: '#fff' }}>{results.length}</strong> issues in your library
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <div className="animate-spin" style={{ marginBottom: '16px' }}><Search size={32} /></div>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '8px' }}>{statusMessage}</div>
              {checkedCount > 0 && <div>Checked {checkedCount} items... Found {results.length} issues so far.</div>}
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#34d399' }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Perfect Library! 🎉</h3>
              <p>No date mismatches found. All files have original EXIF dates matching the database.</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No matches for your search.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px', width: '60px' }}>Image</th>
                  <th style={{ padding: '12px' }}>Filename & Album</th>
                  <th style={{ padding: '12px' }}>Immich DB Date</th>
                  <th style={{ padding: '12px' }}>DateTimeOriginal</th>
                  <th style={{ padding: '12px' }}>CreateDate</th>
                  <th style={{ padding: '12px' }}>ModifyDate</th>
                  <th style={{ padding: '12px', width: '140px', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map(r => (
                  <tr key={r.assetId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px' }}>
                      <img 
                        src={`/api/assets/${r.assetId}/thumbnail`} 
                        alt="thumb" 
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{r.originalFileName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {r.albumNames.join(', ')}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: '#2dd4bf' }}>
                      {new Date(r.dbDate).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px', color: r.exifDate ? '#f87171' : '#fca5a5' }}>
                      {r.exifDate ? new Date(r.exifDate).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {r.createDate ? new Date(r.createDate).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {r.modifyDate ? new Date(r.modifyDate).toLocaleString() : '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)', padding: '6px 10px', borderRadius: '6px', color: '#facc15', fontSize: '0.75rem', fontWeight: 600 }}>
                        <AlertTriangle size={14} />
                        {r.status === 'NO_EXIF' ? 'Missing EXIF' : `Mismatch (${r.diffMinutes}m)`}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {!loading && nextPage && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <button
                className="btn-primary"
                onClick={() => fetchDiagnosticsStream(nextPage)}
              >
                Scan More (Limit Reached)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
