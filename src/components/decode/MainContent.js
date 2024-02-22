import React, { useState, useEffect } from 'react';
import MainContentView from "./MainContentView";
import './MainContent.less';

import { Layout, Popover, Button } from 'antd';
import { MenuFoldOutlined, ArrowRightOutlined, CloseOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
const { Content } = Layout;

const MainContent = ({toolChain, cancel, folded}) => {
    const [current, setCurrent] = useState(0);
    const [chainNodes, setChainNodes] = useState([]);
    const [isFolded, setIsFolded] = useState(false);
    const [activeBox, setActiveBox] = useState({ "width": 0, "offset": 0})

    useEffect(() => {
        setCurrent(toolChain.length -1 )
        setChainNodes(toolChain.map((t, index) => {
            const node = JSON.parse(JSON.stringify(t))
            node.value = ""
            const old = chainNodes.find(n => n.code === t.code)
            if (old){
                node.value = old.value
            }
            node.do = t.do
            if (index > 0){
                try {
                    let input = chainNodes[index - 1].value
                    if (typeof input != "string") {
                        input = JSON.stringify(input)
                    }
                    node.value = node.do.call(node, input)
                } catch (e) {
                    node.value = "转化异常：" + e.toString()
                }

            }
            return node
        }))
    }, [toolChain]);

    useEffect(() => {
        if (current === 0){
            setActiveBox({ "width": 0, "offset": 0})
            return
        }
        const activeEle = document.getElementById('breadcrumb-item-active');
        if (activeEle){
            setActiveBox({ "width": activeEle.offsetWidth, "offset": activeEle.offsetLeft})
        }
    }, [current]);

    const breadcrumb = chainNodes.map((t, index) => {
        const tag = <Button type="text" size={"small"}
                            disabled={current === index}
                            onClick={e => {
                                setCurrent(chainNodes.findIndex(item => item.code === t.code))
                            }}>
            {t.name} {t.dirty ? <span style={{color: "red"}}>*</span>:""}
        </Button>
        const id = current === index ? "breadcrumb-item-active" : "";
        const itemClassName = current === index ? "breadcrumb-item breadcrumb-item-active" : "breadcrumb-item"
        if (index === 0) {
            return <span id={id} className={itemClassName} key={t.code}>
                {tag}
            </span>
        }
        return <span id={id} className={itemClassName} key={t.code}>
            {/*<Popover placement="bottomLeft" title="Title">
                {tag}
            </Popover>*/}
            {tag}
            <Button type="text" size={"small"} shape="circle"
                                 onClick={() => cancel(t)}
                                 icon={<CloseOutlined/>} className="remove-btn"/>
        </span>
    }).reduce((accu, elem) => {
        return accu === null ? [elem] : [...accu, <ArrowRightOutlined className="arrow-separate" />, elem]
    }, null)

    const onChange = (tool, v) => {
        tool.dirty = true
        const newChain = [...chainNodes]
        const index = newChain.findIndex(n => n.code === tool.code)
        newChain[index] = {...newChain[index], value: v}
        for (let i = index + 1; i < newChain.length; i++) {
            const elem = newChain[i]
            elem.dirty = false
            let value = ""
            try {
                let input = newChain[i - 1].value
                if (typeof input != "string") {
                    input = JSON.stringify(input)
                }
                value = elem.do.call(elem, input)
            } catch (e) {
                value = "转化异常：" + e.toString()
            }
            newChain[i] = {
                ...elem, value: value
            }
        }
        setChainNodes(newChain)
    }
    const onFolded = () => {
        setIsFolded(!isFolded)
        folded(!isFolded)
    }
    let view
    if (chainNodes[current]){
        view = <MainContentView tool={chainNodes[current]} onChange={onChange}/>
    }
    let activeStyle = {
        transform: "translateX(" + activeBox.offset +"px)",
        width: activeBox.width + "px"
    }

    return <div className="main-content">
        <div className="breadcrumb-nav">
            <Button type="text" size={"small"} onClick={onFolded}
                    icon={isFolded? <MenuUnfoldOutlined/>:<MenuFoldOutlined/>}/>
            {breadcrumb}
            <div className="active-bar" style={activeStyle}/>
        </div>
        <Content
            className="site-layout-background"
            style={{
                margin: "2px 0 0 0",
                minHeight: 280,
            }}
        >
            {view}
        </Content>
    </div>
};
export default MainContent;
