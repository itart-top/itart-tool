import React, { useState } from 'react';
import DecodePage from "./components/decode";
import './App.less';
import { Layout, Menu } from 'antd';
import Comparator from "./components/comparator";
const { Header } = Layout;

const menus = ['格式编码', "内容比较"].map((key) => ({
    key,
    label: `${key}`,
}));

const App = () =>{
    const [currentMenu, setCurrentMenu] = useState("格式编码");

    return <Layout style={{backgroundColor: "unset"}}>
        <Header className="header" style={{ position: 'fixed', zIndex: 1, width: '100%', padding: 0 }}>
            <div className="header-logo">
                <a href="https://itart.cn" target="_blank">艺术码农的小栈</a>
            </div>
            <Menu theme="dark" mode="horizontal"
                  style={{marginLeft: "150px"}}
                  defaultSelectedKeys={[currentMenu]}
                  onClick={v => setCurrentMenu(v.key)}
                  items={menus} />
        </Header>
        <Layout style={{backgroundColor: "unset"}}>
            { currentMenu === "格式编码" && <DecodePage/>}
            { currentMenu === "内容比较" && <Comparator/>}
        </Layout>
        <div className="footer" style={{position: "fixed", textAlign: "center", width: "100%", bottom: 0}}>
            <p className="cyber-security">
                <span> Copyright © Hyman 2009 - 2022</span>
                <img src="https://img.alicdn.com/tfs/TB1..50QpXXXXX7XpXXXXXXXXXX-40-40.png"/>
                <a href="https://beian.miit.gov.cn" target="_blank">闽ICP备2020020970号-1</a>
            </p>
        </div>
    </Layout>
};
export default App;
