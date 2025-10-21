import React, { useEffect, useState } from 'react';
import { Card, Table, Spinner } from 'react-bootstrap';
import { ScheduleEntry, TimeSlot, Day, ScheduleResponse } from '../lib/types';

interface Props {
  level: number;
  group: number;
  refreshSignal?: number;
}

  const ScheduleTable: React.FC<Props> = ({ level, group, refreshSignal = 0 }) => {
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const filterTimeSlots = (slots: TimeSlot[]): TimeSlot[] => {
    return slots.filter(slot => {
      const [startTime, endTime] = slot.time_slot.split('-').map(t => t.trim());
      const [startHourStr, startMinStr] = startTime.split(':');
      const [endHourStr, endMinStr] = endTime.split(':');
      const startHour = parseInt(startHourStr);
      const startMin = parseInt(startMinStr);
      const endHour = parseInt(endHourStr);
      const endMin = parseInt(endMinStr);
      const startTotalMin = startHour * 60 + startMin;
      const endTotalMin = endHour * 60 + endMin;
      const durationMin = endTotalMin - startTotalMin;
      if (durationMin !== 50) return false;
      if (startHour < 8 || startHour > 14) return false;
      return true;
    });
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [tsRes, daysRes, schedRes] = await Promise.all([
          fetch('/api/data/timeSlots'),
          fetch('/api/data/days'),
          fetch(`/api/data/schedule?level=${level}&group=${group}`)
        ]);
        const tsJson = await tsRes.json();
        const daysJson = await daysRes.json();
        const schedJson = await schedRes.json();

        if (tsJson.success) {
          setTimeSlots(filterTimeSlots(tsJson.timeSlots));
        }
        if (daysJson.success) {
          setDays(daysJson.days);
        }
        if (schedJson.success && schedJson.entries) {
          const normalized = (schedJson.entries as any[]).map((e: any) => ({
            ...e,
            group_num: e.group_num || e.group || e.grp || group,
          }));
          setScheduleData(normalized);
        } else {
          setScheduleData([]);
        }
      } catch (e) {
        setScheduleData([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [level, group, refreshSignal]);

  const shouldRenderCell = (day: string, currentTimeSlot: string): { render: boolean; rowSpan: number; entry: ScheduleEntry | null } => {
    const [currentStart] = currentTimeSlot.split('-').map(t => t.trim());
    const currentStartHour = parseInt(currentStart.split(':')[0]);
    const currentStartMin = parseInt(currentStart.split(':')[1]);

    for (const entry of scheduleData) {
      if (entry.group_num !== group || entry.day !== day) continue;

      const [entryStart, entryEnd] = entry.time_slot.split('-').map(t => t.trim());
      const entryStartHour = parseInt(entryStart.split(':')[0]);
      const entryStartMin = parseInt(entryStart.split(':')[1]);
      const entryEndHour = parseInt(entryEnd.split(':')[0]);
      const entryEndMin = parseInt(entryEnd.split(':')[1]);

      const entryStartTotalMin = entryStartHour * 60 + entryStartMin;
      const entryEndTotalMin = entryEndHour * 60 + entryEndMin;
      const durationMin = entryEndTotalMin - entryStartTotalMin;

      if (currentStartHour === entryStartHour && currentStartMin === entryStartMin) {
        const rowSpan = durationMin >= 100 ? 2 : 1;
        return { render: true, rowSpan, entry };
      }

      const currentStartTotalMin = currentStartHour * 60 + currentStartMin;
      if (currentStartTotalMin > entryStartTotalMin && currentStartTotalMin < entryEndTotalMin) {
        return { render: false, rowSpan: 0, entry: null };
      }
    }

    return { render: true, rowSpan: 1, entry: null };
  };

  return (
    <Card className="shadow-sm mb-4 border-0 overflow-hidden">
      <Card.Header
        className="py-3"
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
          color: 'white',
          border: 'none'
        }}
      >
        <h5 className="mb-0 fw-semibold">
          <i className="bi bi-calendar-week me-2"></i>
          Level {level} - Group {group}
        </h5>
      </Card.Header>
      <Card.Body className="p-0">
        {isLoading ? (
          <div className="text-center p-4">
            <Spinner animation="border" style={{ color: '#1e3a5f' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <Table className="mb-0" style={{ minWidth: '800px' }}>
              <thead>
                <tr style={{ background: '#87CEEB' }}>
                  <th
                    style={{
                      width: '130px',
                      background: '#1e3a5f',
                      color: 'white',
                      fontWeight: '600',
                      padding: '12px',
                      fontSize: '0.9rem',
                      border: 'none'
                    }}
                  >
                    Time/Day
                  </th>
                  {days.map(d => (
                    <th
                      key={d.day}
                      className="text-center"
                      style={{
                        color: '#1e3a5f',
                        fontWeight: '600',
                        padding: '12px',
                        fontSize: '0.9rem',
                        border: 'none',
                        borderLeft: '1px solid #dee2e6'
                      }}
                    >
                      {d.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((ts, idx) => (
                  <tr key={ts.time_slot}>
                    <td
                      className="fw-semibold text-center align-middle"
                      style={{
                        background: '#b0c4d4',
                        color: '#1e3a5f',
                        fontSize: '0.85rem',
                        padding: '12px',
                        border: 'none',
                        borderTop: idx > 0 ? '1px solid #dee2e6' : 'none'
                      }}
                    >
                      {ts.time_slot}
                    </td>
                    {days.map(d => {
                      const cellInfo = shouldRenderCell(d.day, ts.time_slot);
                      if (!cellInfo.render) {
                        return null;
                      }
                      const entry = cellInfo.entry;

                      return (
                        <td
                          key={`${d.day}-${ts.time_slot}`}
                          className="text-center align-middle position-relative"
                          rowSpan={cellInfo.rowSpan}
                          style={{
                            minHeight: cellInfo.rowSpan === 2 ? '180px' : '90px',
                            background: entry ? '#e6f4ff' : 'white',
                            padding: '12px',
                            border: 'none',
                            borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                            borderLeft: '1px solid #dee2e6',
                            transition: 'all 0.2s ease',
                            verticalAlign: 'middle'
                          }}
                        >
                          {entry ? (
                            <div className="position-relative">
                              <div
                                className="fw-bold mb-1"
                                style={{
                                  fontSize: '0.95rem',
                                  color: '#1e3a5f'
                                }}
                              >
                                {entry.time_slot}
                              </div>
                              <div
                                className="fw-bold mb-1"
                                style={{
                                  fontSize: '1rem',
                                  color: '#1e3a5f'
                                }}
                              >
                                {entry.course_code}
                              </div>
                              <div
                                className="small"
                                style={{
                                  fontSize: '0.8rem',
                                  color: '#1e3a5f'
                                }}
                              >
                                {entry.course_name}
                              </div>
                              {entry.activity_type && (
                                <div
                                  className="small mt-1"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#1e3a5f'
                                  }}
                                >
                                  <span style={{
                                    background: entry.activity_type === 'Lecture' ? '#e3f2fd' :
                                      entry.activity_type === 'Lab' ? '#f3e5f5' : '#e8f5e9',
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    fontSize: '0.7rem'
                                  }}>
                                    {entry.activity_type}
                                  </span>
                                </div>
                              )}
                              <div
                                className="small mt-1"
                                style={{
                                  fontSize: '0.75rem',
                                  color: '#1e3a5f'
                                }}
                              >
                                Section {entry.section_num}
                              </div>
                              {entry.room && (
                                <div
                                  className="small mt-1"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: '#1e3a5f',
                                    fontWeight: '500'
                                  }}
                                >
                                  <i className="bi bi-geo-alt-fill me-1"></i>
                                  {entry.room}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div
                              className="text-muted"
                              style={{
                                fontSize: '0.85rem',
                                opacity: 0.4
                              }}
                            >
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default ScheduleTable;


