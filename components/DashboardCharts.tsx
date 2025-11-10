import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Card, Row, Col, Alert, Table, Badge } from 'react-bootstrap';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardChartsProps {
  level?: number;
  role?: string;
}

interface CoursePreference {
  course_code: string;
  course_name: string;
  student_count: number;
}

interface LevelData {
  level: number;
  courses: CoursePreference[];
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ level }) => {
  const [preferencesData, setPreferencesData] = useState<LevelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudentPreferences = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Add cache-busting timestamp to prevent stale data
      const timestamp = new Date().getTime();
      const url = level 
        ? `/api/analytics/student-preferences?level=${level}&_t=${timestamp}`
        : `/api/analytics/student-preferences?_t=${timestamp}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('DashboardCharts: Received data:', {
        success: data.success,
        dataLength: data.data?.length || 0,
        totalRecords: data.totalRecords || 0,
        level: level
      });
      
      if (data.success) {
        const preferences = data.data || [];
        console.log('DashboardCharts: Setting preferences data:', preferences);
        setPreferencesData(preferences);
        
        // If we got data but it's empty, check if it's really empty or if there's an issue
        if (preferences.length === 0 && data.totalRecords > 0) {
          console.warn('DashboardCharts: API returned totalRecords but empty data array');
        }
      } else {
        const errorMsg = data.error || data.message || 'Failed to load student preferences';
        console.error('DashboardCharts: API returned error:', errorMsg);
        setError(errorMsg);
      }
    } catch (error: any) {
      console.error('Error fetching student preferences:', error);
      setError(`Failed to load student preferences: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    fetchStudentPreferences();
  }, [fetchStudentPreferences]);

  if (loading) {
    return (
      <div className="text-center p-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading student preferences...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="warning" className="m-4">
        <Alert.Heading>No Data Available</Alert.Heading>
        <p>{error}</p>
        <p className="mb-0">Students need to submit their course preferences first.</p>
      </Alert>
    );
  }

  if (!preferencesData || preferencesData.length === 0) {
    return (
      <Alert variant="info" className="m-4">
        <Alert.Heading>No Preferences Found</Alert.Heading>
        <p>No student course preferences have been submitted yet.</p>
        <p className="mb-0">Students can submit their elective course preferences from their home page.</p>
      </Alert>
    );
  }

  const getChartOptions = (level: number): any => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: `Level ${level} - Most Selected Courses`,
          font: {
            size: 18,
            weight: 'bold' as const,
          },
          color: '#1e3a5f',
          padding: {
            top: 10,
            bottom: 20,
          },
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              return `${context.parsed.y} student(s) selected this course`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
          },
          title: {
            display: true,
            text: 'Number of Students',
            font: {
              size: 12,
              weight: 'bold' as const,
            },
          },
        },
        x: {
          title: {
            display: true,
            text: 'Course',
            font: {
              size: 12,
              weight: 'bold' as const,
            },
          },
        },
      },
    };
  };

  return (
    <Row className="g-4">
      {preferencesData.map((levelData) => {
        // Get top 20 most selected courses for this level (for chart)
        const topCourses = levelData.courses.slice(0, 20);
        
        if (topCourses.length === 0) {
          return null;
        }

        const chartData = {
          labels: topCourses.map(course => course.course_code),
          datasets: [
            {
              label: 'Number of Students',
              data: topCourses.map(course => course.student_count),
              backgroundColor: 'rgba(30, 58, 95, 0.8)',
              borderColor: 'rgba(30, 58, 95, 1)',
              borderWidth: 2,
            },
          ],
        };

        // Enhanced tooltip to show course name
        const baseOptions = getChartOptions(levelData.level);
        const enhancedChartOptions = {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              callbacks: {
                title: function(context: any) {
                  const index = context[0].dataIndex;
                  const course = topCourses[index];
                  return `${course.course_code} - ${course.course_name}`;
                },
                label: function(context: any) {
                  return `${context.parsed.y} student(s) selected this course`;
                }
              }
            }
          }
        };

        return (
          <Col md={12} key={levelData.level}>
            <Card className="border-0 shadow-sm">
              <Card.Header style={{ background: '#1e3a5f', color: 'white' }}>
                <h5 className="mb-0">
                  <i className="bi bi-bar-chart-fill me-2"></i>
                  Level {levelData.level} - Most Selected Courses by Students
                </h5>
              </Card.Header>
              <Card.Body>
                <div style={{ height: '500px' }}>
                  <Bar data={chartData} options={enhancedChartOptions} />
                </div>
                <div className="mt-3">
                  <p className="text-muted mb-2">
                    <small>
                      <strong>Top {topCourses.length} most selected courses</strong> out of {levelData.courses.length} total courses with student preferences.
                    </small>
                  </p>
                  {topCourses.length > 0 && (
                    <div className="mt-2">
                      <strong className="text-muted" style={{ fontSize: '0.9rem' }}>Most Popular: </strong>
                      <span className="badge bg-success me-2">
                        {topCourses[0].course_code} ({topCourses[0].student_count} students)
                      </span>
                    </div>
                  )}
                </div>

                {/* Detailed Table */}
                <Card className="mt-4 border-0 shadow-sm">
                  <Card.Header style={{ background: '#f8f9fa', border: 'none' }}>
                    <h6 className="mb-0" style={{ color: '#1e3a5f' }}>
                      All Course Selections for Level {levelData.level}
                    </h6>
                  </Card.Header>
                  <Card.Body>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <Table striped bordered hover size="sm">
                        <thead style={{ background: '#1e3a5f', color: 'white', position: 'sticky', top: 0 }}>
                          <tr>
                            <th>Rank</th>
                            <th>Course Code</th>
                            <th>Course Name</th>
                            <th className="text-center">Number of Students</th>
                          </tr>
                        </thead>
                        <tbody>
                          {levelData.courses.map((course, index) => (
                            <tr key={course.course_code}>
                              <td>
                                {index === 0 && <Badge bg="success">#1</Badge>}
                                {index === 1 && <Badge bg="info">#2</Badge>}
                                {index === 2 && <Badge bg="warning">#3</Badge>}
                                {index > 2 && <span className="text-muted">#{index + 1}</span>}
                              </td>
                              <td><strong>{course.course_code}</strong></td>
                              <td>{course.course_name}</td>
                              <td className="text-center">
                                <Badge bg="primary">{course.student_count} student{course.student_count !== 1 ? 's' : ''}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

export default DashboardCharts;

