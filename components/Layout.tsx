import React, { useState, useEffect } from 'react';
import { Container, Navbar, Nav, Button } from 'react-bootstrap';
import { useRouter } from 'next/router';
import 'bootstrap-icons/font/bootstrap-icons.css';
import Image from 'next/image';
import NotificationCenter from './NotificationCenter';

interface LayoutProps {
  children: React.ReactNode;
}

const getUserDisplayName = (userData: any): string => {
  if (!userData) {
    return '';
  }

  const explicitName = userData.name || userData.fullName;
  if (explicitName && typeof explicitName === 'string' && explicitName.trim()) {
    return explicitName.trim();
  }

  const first = userData.firstName || userData.first_name || '';
  const last = userData.lastName || userData.last_name || '';
  const combined = `${first} ${last}`.trim();
  if (combined) {
    return combined;
  }

  if (userData.email && typeof userData.email === 'string') {
    const [localPart] = userData.email.split('@');
    if (localPart) {
      return localPart;
    }
  }

  return '';
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<{ user_id: number; role: string; displayName?: string } | null>(null);

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.user_id && parsedUser.role) {
          const userRole = parsedUser.role.toLowerCase().trim();
          setUser({
            user_id: parsedUser.user_id,
            role: userRole,
            displayName: getUserDisplayName(parsedUser),
          });
          console.log('Layout: User role detected:', userRole);
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, []);

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
      href: '/scheduleCommittee/dashboards',
      label: 'Dashboard',
      icon: 'fa-chart-bar',
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
      href: '/scheduleCommittee/sections',  
      label: 'Sections',
      icon: 'fa-users',
    },
  ];

  // Check if current page is Teaching Load Committee page
  const isCommitteeLikePage =
  router.pathname.includes('teachingLoadCommittee') ||
  router.pathname.includes('studentHomePage') ||
  router.pathname.includes('facultyHomePage');

  // Check if we're on scheduling committee pages - ALWAYS hide notification here
  const isSchedulingCommitteePage = router.pathname.includes('scheduleCommittee');

  // Determine if notification should be shown
  // ALWAYS hide for scheduling committee pages, regardless of user role
  // Also hide for scheduling_committee role on other pages
  const shouldShowNotification = !isSchedulingCommitteePage && 
    user && 
    user.role !== 'scheduling_committee' && 
    user.role !== 'committee';

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
      />

      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #87CEEB 100%)',
          minHeight: '100vh',
        }}
      >
        {/* Navigation */}
        <Navbar
          expand="lg"
          variant="dark"
          style={{ background: '#1e3a5f' }}
          className="shadow-sm"
        >
          <Container>
            <Navbar.Brand className="fw-bold d-flex align-items-center">
              <Image 
                src="/logo.png" 
                alt="SmartSchedule Logo" 
                width={100} 
                height={40}
                className="me-2"
                style={{ objectFit: 'contain' }}
              />
              <span style={{ color: 'white' }}>SmartSchedule</span>
            </Navbar.Brand>

            <Navbar.Toggle aria-controls="basic-navbar-nav" />

            <Navbar.Collapse id="basic-navbar-nav">
              <Nav className="me-auto">
                {/* Only show navigation items if NOT on Teaching Load Committee page */}
                {!isCommitteeLikePage && navigationItems.map((item, index) => (
                  <Nav.Link
                    key={index}
                    href={item.href}
                    className={`px-3 d-flex align-items-center ${
                      router.pathname === item.href ? 'active' : ''
                    }`}
                    style={{
                      background:
                        router.pathname === item.href
                          ? '#87CEEB'
                          : 'transparent',
                      borderRadius: '8px',
                      margin: '0 2px',
                      color: router.pathname === item.href ? '#1e3a5f' : 'white',
                      fontWeight: router.pathname === item.href ? '600' : '400',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <i className={`fas ${item.icon} me-2`}></i>
                    {item.label}
                  </Nav.Link>
                ))}
              </Nav>

              <div className="d-flex align-items-center" style={{ gap: '0.5rem' }}>
                {user?.displayName && (
                  <span
                    className="d-flex align-items-center"
                    style={{ color: 'white', fontWeight: 500, gap: '0.35rem' }}
                  >
                    <span role="img" aria-label="User">
                      👤
                    </span>
                    <span>{user.displayName}</span>
                  </span>
                )}

                {/* Notification Center - NEVER show on scheduling committee pages */}
                {!isSchedulingCommitteePage && user && user.role !== 'scheduling_committee' && user.role !== 'committee' && (
                  <NotificationCenter userId={user.user_id} role={user.role} />
                )}

                {/* Logout Button */}
                <Button
                  onClick={handleLogout}
                  className="d-flex align-items-center border-0"
                  style={{ 
                    background: '#87CEEB',
                    color: '#1e3a5f',
                    fontWeight: '600',
                  }}
                >
                  <i className="fas fa-sign-out-alt me-2"></i>
                  Logout
                </Button>
              </div>
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