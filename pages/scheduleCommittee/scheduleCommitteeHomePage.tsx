import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Table, Alert, Spinner } from 'react-bootstrap';
import Layout from '../../components/Layout';

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
}

interface TimeSlot {
  time_slot: string;
}

interface Day {
  day: string;
}

const SchedulingCommitteeHomePage: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [scheduleData, setScheduleData] = useState<ScheduleEntry[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [days, setDays] = useState<Day[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{type: 'success' | 'danger' | 'warning', message: string} | null>(null);
  
  const levels = [3, 4, 5, 6, 7, 8];

  const getGroupsForLevel = (level: number): number[] => {
    switch (level) {
      case 3: return [1, 2];
      case 4: return [1];
      case 5: return [1, 2];
      case 6: return [1];
      case 7: return [1, 2];
      case 8: return [1];
      default: return [1];
    }
  };

  useEffect(() => {
    fetchTimeSlots();
    fetchDays();
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [selectedLevel]);

  const fetchTimeSlots = async () => {
    try {
      const response = await fetch('/api/data/timeSlots');
      const data = await response.json();
      if (data.success) {
        setTimeSlots(data.timeSlots);
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
      const groups = getGroupsForLevel(selectedLevel);
      const allSchedules: ScheduleEntry[] = [];
      
      for (const groupNum of groups) {
        const response = await fetch(`/api/data/schedule?level=${selectedLevel}&group=${groupNum}`);
        const data = await response.json();
        
        if (data.success && data.entries) {
          allSchedules.push(...data.entries.map((s: any) => ({ ...s, group_num: groupNum })));
        }
      }
      
      setScheduleData(allSchedules);
      
      if (allSchedules.length === 0) {
        setAlert({
          type: 'warning',
          message: `No schedule entries found for Level ${selectedLevel}`
        });
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setAlert({type: 'danger', message: 'Error fetching schedule data'});
    } finally {
      setIsLoading(false);
    }
  };

  const generateAISchedule = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel })
      });
      
      const data = await response.json();
      if (data.success) {
        setAlert({type: 'success', message: 'AI schedule generated successfully!'});
        fetchSchedule();
      } else {
        setAlert({type: 'danger', message: data.message || 'Failed to generate schedule'});
      }
    } catch (error) {
      console.error('Error generating AI schedule:', error);
      setAlert({type: 'danger', message: 'Error generating AI schedule'});
    } finally {
      setIsLoading(false);
    }
  };

  const getScheduleEntry = (groupNum: number, day: string, timeSlot: string) => {
    return scheduleData.find(
      entry => entry.group_num === groupNum && entry.day === day && entry.time_slot === timeSlot
    );
  };

  const renderScheduleTab = () => {
    const groups = getGroupsForLevel(selectedLevel);
    
    return (
      <div>
        <Row className="mb-4 g-3">
          <Col lg={3} md={4}>
            <Card className="border-0 shadow-sm h-100" style={{ background: 'f8f9fa' }}>
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
                      background: '#87CEEB',
                      color: '#1e3a5f',
                      padding: '8px 20px',
                      fontSize: '0.9rem'
                    }}
                    onClick={fetchSchedule}
                  >
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    Refresh Schedule
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

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
                          const entry = getScheduleEntry(groupNum, d.day, ts.time_slot);
                          return (
                            <td
                              key={`${d.day}-${ts.time_slot}`}
                              className="text-center align-middle"
                              style={{
                                minHeight: '90px',
                                background: entry ? '#e6f4ff' : 'white',
                                padding: '12px',
                                border: 'none',
                                borderTop: idx > 0 ? '1px solid #dee2e6' : 'none',
                                borderLeft: '1px solid #dee2e6',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {entry ? (
                                <div>
                                  <div 
                                    className="fw-bold mb-1"
                                    style={{ 
                                      fontSize: '0.95rem',
                                      color: '#1e3a5f'
                                    }}
                                  >
                                    {entry.course_code}
                                  </div>
                                  <div 
                                    className="small mb-1"
                                    style={{ 
                                      fontSize: '0.8rem',
                                      color: '#5a7a99'
                                    }}
                                  >
                                    {entry.course_name}
                                  </div>
                                  <div 
                                    className="small"
                                    style={{ 
                                      fontSize: '0.75rem',
                                      color: '#6b8ca8'
                                    }}
                                  >
                                    Section {entry.section_num}
                                  </div>
                                  {entry.room && (
                                    <div 
                                      className="small mt-1"
                                      style={{ 
                                        fontSize: '0.75rem',
                                        color: '#87CEEB',
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
              View and manage course schedules by level and group
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