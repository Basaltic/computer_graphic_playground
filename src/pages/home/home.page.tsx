import React from 'react';
import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <>
      <h3>示例入口(CPU模拟)：</h3>
      <div>
        <Link to="/raster-basic">光栅化三角形</Link>
      </div>
      <div style={{ marginTop: 10 }}>
        <Link to="/shading">着色</Link>
      </div>
    </>
  );
}
