import React from 'react';
import { Container, Navbar, Nav, Dropdown } from 'react-bootstrap';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const navigationItems = [
    {
      href: '/scheduleCommittee/scheduleCommitteeHomePage',
      label: 'Schedules',
      icon: 'fa-calendar',
    },
    {
      href: '/committee/exam-timing',
      label: 'Exam Timing',
      icon: 'fa-clock',
    },
    {
      href: '/scheduleCommittee/scheduleCommitteeRules',
      label: 'Rules',
      icon: 'fa-gavel',
    },
    {
      href: '/scheduleCommittee/AddOtherDepartment',
      label: 'Other Departments',
      icon: 'fa-university',
    },
    {
      href: '/committee/sections',
      label: 'Sections',
      icon: 'fa-users',
    },
  ];

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

      <div
        style={{
          background: 'linear-gradient(135deg, #2F4156 0%, #567C8D 100%)',
          minHeight: '100vh',
        }}
      >
        {/* Navigation */}
        <Navbar
          expand="lg"
          variant="dark"
          style={{ background: '#2F4156' }}
          className="shadow-sm"
        >
          <Container>
            <Navbar.Brand className="fw-bold d-flex align-items-center">
              <i className="fas fa-calendar-check me-2"></i>
              SmartSchedule
            </Navbar.Brand>

            <Navbar.Toggle aria-controls="basic-navbar-nav" />

            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                {navigationItems.map((item, index) => (
                  <Nav.Link
                    key={index}
                    href={item.href}
                    className={`px-3 d-flex align-items-center ${
                      router.pathname === item.href ? 'active' : ''
                    }`}
                    style={{
                      background:
                        router.pathname === item.href
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                      borderRadius: '8px',
                      margin: '0 2px',
                    }}
                  >
                    <i className={`fas ${item.icon} me-2`}></i>
                    {item.label}
                  </Nav.Link>
                ))}
              </Nav>

              {/* Simplified dropdown with only Sign Out */}
              <Dropdown align="end">
                <Dropdown.Toggle
                  variant="outline-light"
                  id="user-dropdown"
                  className="d-flex align-items-center border-0"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  <i className="fas fa-sign-out-alt me-2"></i>
                  Sign Out
                </Dropdown.Toggle>

                <Dropdown.Menu
                  style={{
                    background: '#F5EFEB',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  }}
                >
                  <Dropdown.Item
                    onClick={handleLogout}
                    className="d-flex align-items-center text-danger"
                  >
                    <i className="fas fa-sign-out-alt me-2"></i>
                    Logout
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Navbar.Collapse>
          </Container>
        </Navbar>

        {/* Main Content */}
        <div className="flex-grow-1">{children}</div>
      </div>
    </>
  );
};

export default Layout;
