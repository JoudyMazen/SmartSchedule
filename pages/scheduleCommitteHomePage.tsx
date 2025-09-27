import { NextPage } from 'next';
import Head from 'next/head';

const ScheduleView: NextPage = () => {
  return (
    <>
      <Head>
        <title>Schedule View - Smart Schedule System</title>
        <meta name="description" content="View academic schedules" />
      </Head>
      <div className="container-fluid py-4">
        <h2>Schedule View</h2>
        <p>This page will display the detailed schedule view with the grid format shown in your requirements.</p>
      </div>
    </>
  );
};

export default ScheduleView;
