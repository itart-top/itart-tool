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
    return <Layout style={{backgroundColor: "unset"}}>
        <Header className="header" style={{ position: 'fixed', zIndex: 1, width: '100%' }}>
            <Menu theme="dark" mode="horizontal"
                  defaultSelectedKeys={['格式编码']} items={menus} />
        </Header>
        <Layout style={{backgroundColor: "unset"}}>
            <Sider width={280}
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
                    marginLeft: '280px',
                    marginTop: '64px'
                }}
            >
                <MainContent toolChain={toolChain} cancel={cancel}/>
            </Content>
        </Layout>
    </Layout>
};
export default App;
