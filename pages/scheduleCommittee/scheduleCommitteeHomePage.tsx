import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner, Modal } from 'react-bootstrap';
import Layout from '../../components/Layout';
import { useRouter } from 'next/router';

interface ScheduleEntry {
  schedule_id: number;
  section_num: number;
  course_code: string;
  course_name: string;
  time_slot: string;
  day: string;
  room: string;
  instructor: string;
  group_num: number;
  activity_type?: string;
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

const SchedulingCommitteeHomePage: React.FC = () => {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning', message: string} | null>(null);
  const [showConfigureGroupsModal, setShowConfigureGroupsModal] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<number[]>([1]);

  const levels = [3, 4, 5, 6, 7, 8];

  const getGroupsForLevel = (level: number): number[] => {
    return availableGroups;
  };

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
    fetchTimeSlots();
    fetchDays();
  }, []);

  useEffect(() => {
    fetchAvailableGroups(selectedLevel);
    fetchSchedule();
  }, [selectedLevel]);
  
  useEffect(() => {
    if (router.query.refresh === 'true') {
      fetchSchedule();
    }
  }, [router.query.refresh]);
  

  const fetchAvailableGroups = async (level: number) => {
    try {
      const response = await fetch(`/api/data/groups?level=${level}`);
      const data = await response.json();
      if (data.success) {
        setAvailableGroups(data.groups);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setAvailableGroups([1]);
    }
  };

  const fetchTimeSlots = async () => {
    try {
      const response = await fetch('/api/data/timeSlots');
      const data = await response.json();
      if (data.success) {
        const filtered = filterTimeSlots(data.timeSlots);
        setTimeSlots(filtered);
      }
    } catch (error) {
      console.error('Error fetching time slots:', error);
    }
  };

  const fetchDays = async () => {
    try {
      const response = await fetch('/api/data/days');
      const data = await response.json();
      if (data.success) {
        setDays(data.days);
      }
    } catch (error) {
      console.error('Error fetching days:', error);
    }
  };

  const fetchSchedule = async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      const groupsResponse = await fetch(`/api/data/groups?level=${selectedLevel}`);
      const groupsData = await groupsResponse.json();
      const groups = groupsData.success ? groupsData.groups : [1];
      
      setAvailableGroups(groups);
      
      const allSchedules: ScheduleEntry[] = [];
      
      for (const groupNum of groups) {
        const response = await fetch(`/api/data/schedule?level=${selectedLevel}&group=${groupNum}`);
        const data = await response.json();
        if (data.success && data.entries) {
          const normalized = data.entries.map((e: any) => ({
            ...e,
            group_num: e.group_num || e.group || e.grp || 1, 
          }));
          allSchedules.push(...normalized);
        }
        
      }
      
      setScheduleData(allSchedules);
      
      if (allSchedules.length === 0) {
        console.log('No schedule data found');
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setAlert({type: 'danger', message: 'Error fetching schedule data'});
    } finally {
      setIsLoading(false);
    }
  };

  const generateAISchedule = async () => {
    if (!confirm(`Generate AI schedule for Level ${selectedLevel}? This will create optimized schedules for all groups.`)) {
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      const groups = getGroupsForLevel(selectedLevel);
      const results = [];
      if (!groups || groups.length === 0) {
        groups.push(1);
      }

      if (groups.length > 1) {
        // MULTI-GROUP mode (AI generates all groups at once)
        const response = await fetch('/api/ai/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level: selectedLevel,
            numberOfGroups: groups.length,
            useAI: true
          })
        });
        const data = await response.json();
        results.push(data);
      } else {
        // SINGLE-GROUP mode
        const response = await fetch('/api/ai/generate-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level: selectedLevel,
            group: groups[0],
            useAI: true
          })
        });
        const data = await response.json();
        results.push(data);
      }
      

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        setAlert({
          type: 'success',
          message: `AI schedule generated successfully for ${successCount} group(s)!${failureCount > 0 ? ` ${failureCount} group(s) failed.` : ''}`
        });
        await fetchSchedule();
        if (successCount > 0) {
          setAlert({
            type: 'success',
            message: `AI schedule generated successfully for ${successCount} group(s)!`
          });
          await fetchSchedule(); // ✅ This reloads immediately
        }
        
      } else {
        setAlert({
          type: 'danger',
          message: 'Failed to generate AI schedule. Please try again or check for conflicts.'
        });
      }
    } catch (error) {
      console.error('Error generating AI schedule:', error);
      setAlert({
        type: 'danger',
        message: 'Network error occurred while generating schedule.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const shouldRenderCell = (groupNum: number, day: string, currentTimeSlot: string, currentIndex: number): { render: boolean; rowSpan: number; entry: ScheduleEntry | null } => {
    const [currentStart, currentEnd] = currentTimeSlot.split('-').map(t => t.trim());
    const currentStartHour = parseInt(currentStart.split(':')[0]);
    const currentStartMin = parseInt(currentStart.split(':')[1]);

    for (const entry of scheduleData) {
      if (entry.group_num !== groupNum || entry.day !== day) continue;

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

  const renderScheduleTab = () => {
    const groups = getGroupsForLevel(selectedLevel);

    return (
      <div>
        <Row className="mb-4 g-3">
          <Col lg={3} md={4}>
            <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
              <Card.Body>
                <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Select Level</h6>
                <Form.Select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
                  className="border-2"
                  style={{
                    borderColor: '#87CEEB',
                    color: '#1e3a5f',
                    fontSize: '0.95rem'
                  }}
                >
                  {levels.map(level => (
                    <option key={level} value={level}>Level {level}</option>
                  ))}
                </Form.Select>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={9} md={8}>
            <Card className="border-0 shadow-sm h-100" style={{ background: '#f8f9fa' }}>
              <Card.Body>
                <h6 className="mb-3 fw-semibold" style={{ color: '#1e3a5f' }}>Actions</h6>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                      color: '#FFFFF',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={() => setShowConfigureGroupsModal(true)}
                  >
                    <i className="bi bi-gear me-2"></i>
                    Manage Groups
                  </Button>
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                      color: 'white',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={() => router.push('/scheduleCommittee/EditSchedule')}
                  >
                    <i className="bi bi-pencil-square me-2"></i>
                    Edit Schedule
                  </Button>
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
                      color: 'white',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={generateAISchedule}
                    disabled={isLoading}
                  >
                    <i className="bi bi-magic me-2"></i>
                    Generate AI Schedule
                  </Button>
                  <Button
                    className="border-0 shadow-sm"
                    style={{
                      background: '#b0c4d4',
                      color: '#1e3a5f',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={fetchSchedule}
                  >
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Refresh
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
 
<Modal 
  show={showConfigureGroupsModal} 
  onHide={() => setShowConfigureGroupsModal(false)}
  centered
>
  <Modal.Header 
    closeButton 
    style={{ 
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', 
      border: 'none' 
    }} 
    className="text-white"
  >
    <Modal.Title className="fw-semibold">
      <i className="bi bi-gear me-2"></i>
      Manage Groups
    </Modal.Title>
  </Modal.Header>
  <Modal.Body style={{ background: 'white', padding: '2rem' }}>
    <div className="mb-4">
      <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
        Level {selectedLevel}
      </h6>
      
      {availableGroups.length > 0 ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {availableGroups.map(groupNum => (
            <div
              key={groupNum}
              className="badge d-flex align-items-center gap-2"
              style={{
                background: '#e6f4ff',
                border: '2px solid #87CEEB',
                color: '#1e3a5f',
                padding: '10px 16px',
                fontSize: '0.95rem',
                fontWeight: '600'
              }}
            >
              Group {groupNum}
              {availableGroups.length > 1 && (
                <i 
                  className="bi bi-x-circle-fill text-danger" 
                  style={{ cursor: 'pointer', fontSize: '1.1rem' }}
                  onClick={async () => {
                    if (!confirm(`Delete Group ${groupNum}?`)) return;
                    
                    try {
                      const response = await fetch(
                        `/api/data/manageGroups?level=${selectedLevel}&group=${groupNum}`,
                        { method: 'DELETE' }
                      );
                      const data = await response.json();
                      
                      if (data.success) {
                        setAlert({ type: 'success', message: data.message });
                        await fetchAvailableGroups(selectedLevel);
                        await fetchSchedule();
                      } else {
                        setAlert({ type: 'danger', message: data.error });
                      }
                    } catch (error) {
                      setAlert({ type: 'danger', message: 'Failed to delete group' });
                    }
                  }}
                  title="Delete group"
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted small">No groups yet</p>
      )}
    </div>
    
    <hr style={{ borderColor: '#dee2e6', margin: '1.5rem 0' }} />
    
    <div>
      <h6 className="fw-semibold mb-3" style={{ color: '#1e3a5f' }}>
        Create New Groups
      </h6>
      
      {/* Number of Students Input */}
      <div className="mb-3">
        <Form.Label className="fw-semibold" style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>
          Number of Students
        </Form.Label>
        <Form.Control
          type="number"
          id="numStudentsInput"
          min="1"
          max="500"
          placeholder="Enter number of students"
          style={{ borderColor: '#87CEEB', fontSize: '0.95rem' }}
          onChange={(e) => {
            const numStudents = parseInt(e.target.value) || 0;
            const calculatedGroups = Math.ceil(numStudents / 25);
            const groupsDisplay = document.getElementById('calculatedGroupsDisplay');
            if (groupsDisplay) {
              groupsDisplay.textContent = calculatedGroups > 0 ? calculatedGroups.toString() : '0';
            }
          }}
        />
        <Form.Text className="text-muted" style={{ fontSize: '0.8rem' }}>
          Maximum 25 students per group
        </Form.Text>
      </div>

      {/* Calculated Groups Display */}
      <div className="mb-3 p-3" style={{ 
        background: '#f8f9fa', 
        borderRadius: '8px',
        border: '2px solid #87CEEB'
      }}>
        <div className="d-flex align-items-center justify-content-between">
          <span className="fw-semibold" style={{ color: '#1e3a5f', fontSize: '0.9rem' }}>
            <i className="bi bi-people-fill me-2"></i>
            Groups Needed:
          </span>
          <span 
            id="calculatedGroupsDisplay"
            className="badge"
            style={{ 
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)',
              color: 'white',
              fontSize: '1.2rem',
              padding: '8px 16px'
            }}
          >
            0
          </span>
        </div>
      </div>

      {/* Create Groups Button */}
      <div className="d-grid">
        <Button
          className="border-0"
          style={{ 
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%)', 
            color: 'white',
            padding: '10px 20px',
            fontSize: '0.95rem',
            fontWeight: '600'
          }}
          onClick={async () => {
            const input = document.getElementById('numStudentsInput') as HTMLInputElement;
            const numStudents = parseInt(input.value);
            
            if (!numStudents || numStudents <= 0) {
              setAlert({ 
                type: 'warning', 
                message: 'Please enter a valid number of students' 
              });
              return;
            }

            const numberOfGroups = Math.ceil(numStudents / 25);
            
            if (!confirm(
              `Create ${numberOfGroups} group(s) for ${numStudents} students?\n` +
              `(${Math.floor(numStudents / numberOfGroups)}-${Math.ceil(numStudents / numberOfGroups)} students per group)`
            )) {
              return;
            }
            
            setIsLoading(true);
            try {
              const response = await fetch('/api/data/manageGroups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  level: selectedLevel, 
                  numberOfGroups 
                })
              });
              
              const data = await response.json();
              
              if (data.success) {
                setAlert({ 
                  type: 'success', 
                  message: `Successfully created ${numberOfGroups} group(s) for ${numStudents} students` 
                });
                await fetchAvailableGroups(selectedLevel);
                await fetchSchedule();
                setShowConfigureGroupsModal(false);
              } else {
                setAlert({ type: 'danger', message: data.error });
              }
            } catch (error) {
              setAlert({ type: 'danger', message: 'Failed to create groups' });
            } finally {
              setIsLoading(false);
            }
          }}
          disabled={isLoading}
        >
          <i className="bi bi-plus-circle me-2"></i>
          {isLoading ? 'Creating...' : 'Create Groups'}
        </Button>
      </div>
    </div>
  </Modal.Body>
  <Modal.Footer style={{ background: '#f8f9fa', borderTop: '1px solid #dee2e6' }}>
    <Button
      className="border-0"
      style={{ 
        background: '#b0c4d4', 
        color: '#1e3a5f',
        padding: '8px 20px'
      }}
      onClick={() => setShowConfigureGroupsModal(false)}
    >
      Close
    </Button>
  </Modal.Footer>
</Modal>

        {groups.map(groupNum => (
          <Card key={groupNum} className="shadow-sm mb-4 border-0 overflow-hidden">
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
                Level {selectedLevel} - Group {groupNum}
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
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
                          const cellInfo = shouldRenderCell(groupNum, d.day, ts.time_slot, idx);
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
            </Card.Body>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div style={{ background: '#ececec', minHeight: '100vh' }}>
        <Container className="py-4">
          <div className="mb-4">
            <h2 className="fw-bold mb-2" style={{ color: '#1e3a5f' }}>
              Schedule Management
            </h2>
            <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
              View and manage course schedules by level and group (08:00 - 14:50)
            </p>
          </div>

          {alert && (
            <Alert
              variant={alert.type}
              onClose={() => setAlert(null)}
              dismissible
              className="border-0 shadow-sm"
            >
              {alert.message}
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center p-5">
              <Spinner animation="border" style={{ color: '#1e3a5f' }} />
              <p className="mt-3" style={{ color: '#1e3a5f' }}>Loading schedule data...</p>
            </div>
          ) : (
            renderScheduleTab()
          )}
        </Container>
      </div>
    </Layout>
  );
};

export default SchedulingCommitteeHomePage;