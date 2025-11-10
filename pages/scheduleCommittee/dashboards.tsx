import React, { useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import Layout from '../../components/Layout';
import DashboardCharts from '../../components/DashboardCharts';

// Disable static generation for this page
export const getServerSideProps = async () => {
  return {
    props: {},
  };
};

const DashboardsPage: React.FC = () => {
  const [selectedLevel, setSelectedLevel] = useState<number | undefined>(undefined);

  return (
    <Layout>
      <Container className="py-4">
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header style={{ background: '#1e3a5f', color: 'white' }}>
                <h4 className="mb-0">
                  <i className="bi bi-bar-chart-fill me-2"></i>
                  Student Course Preferences Dashboard
                </h4>
              </Card.Header>
              <Card.Body>
                <div className="mb-4">
                  <label className="form-label fw-semibold" style={{ color: '#1e3a5f' }}>
                    Filter by Level (Optional):
                  </label>
                  <select
                    className="form-select"
                    value={selectedLevel || ''}
                    onChange={(e) =>
                      setSelectedLevel(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    style={{ maxWidth: '200px' }}
                  >
                    <option value="">All Levels</option>
                    {[3, 4, 5, 6, 7, 8].map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted mt-2 mb-0">
                    <small>
                      <i className="bi bi-info-circle me-1"></i>
                      This dashboard shows which courses are most selected by students for each level.
                      Select a specific level to filter, or view all levels.
                    </small>
                  </p>
                </div>
                <DashboardCharts level={selectedLevel} />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </Layout>
  );
};

export default DashboardsPage;

