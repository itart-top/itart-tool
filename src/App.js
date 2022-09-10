import React, { useState } from 'react';
import SideMenu from "./components/SideMenu";
import MainContent from "./components/MainContent";
import './App.less';
import { Layout, Menu } from 'antd';
const { Header, Content, Sider } = Layout;

const menus = ['格式编码'].map((key) => ({
    key,
    label: `${key}`,
}));

const App = () =>{
    const [isFolded, setIsFolded] = useState(false);

    const [toolChain, setToolChain] = useState([
        {
            name: "原始输入",
            code: "raw-input",
            value: undefined,
            do: (val) => {
                return val
            }
        }
    ]);

    const fire = v => {
        const newInstance = JSON.parse(JSON.stringify(v))
        newInstance.code += "_" + new Date().getTime()
        newInstance.do = v.do
        setToolChain([...toolChain, newInstance])
    }
    const cancel = v => {
        setToolChain(toolChain.filter(c => c.code !== v.code))
    }

    const folded = v => {
        setIsFolded(v)
    }

    return <Layout style={{backgroundColor: "unset"}}>
        <Header className="header" style={{ position: 'fixed', zIndex: 1, width: '100%', padding: 0 }}>
            <div className="header-logo">
                <a href="https://itart.cn" target="_blank">艺术码农的小栈</a>
            </div>
            <Menu theme="dark" mode="horizontal"
                  style={{marginLeft: "150px"}}
                  defaultSelectedKeys={['格式编码']} items={menus} />
        </Header>
        <Layout style={{backgroundColor: "unset"}}>
            <Sider width={isFolded? 0: 280}
                   style={{
                       overflow: 'auto',
                       height: '100vh',
                       position: 'fixed',
                       left: 0,
                       top: 64,
                       bottom: 0,
                   }}
                   className="side-background"
            >
                <SideMenu fire={fire}/>
            </Sider>
            <Content
                style={{
                    padding: "10px",
                    position: 'relative',
                    marginLeft: isFolded? 0: "280px",
                    marginTop: '64px'
                }}>
                <MainContent toolChain={toolChain} cancel={cancel} folded={folded}/>
            </Content>
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
