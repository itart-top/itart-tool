import React, {useEffect, useState} from 'react'
import {Col, Input, Row, Space} from 'antd';
import { Button } from 'antd';
import ReactDiffViewer from 'react-diff-viewer';

const { TextArea } = Input;

const Comparator = ()=> {
    const [winHeight, setWinHeight] = useState(100);
    const [leftValue, setLeftValue] = useState("");
    const [leftErr, setLeftErr] = useState("");
    const [rightValue, setRightValue] = useState("");
    const [rightErr, setRightErr] = useState("");
    const [isEdit, setEdit] = useState(true);

    const resizeHandler = () =>  {
        setWinHeight(window.innerHeight -150)
    }
    useEffect(() => {
        resizeHandler()
        window.addEventListener('resize', resizeHandler)
        return () => {
            window.removeEventListener('resize', resizeHandler)
        }
    }, []);

    const onBeautify = () => {
        setLeftErr("")
        setRightErr("")
        if (leftValue.trim() !== "") {
            try {
                const leftJson = JSON.parse(leftValue)
                setLeftValue(JSON.stringify(leftJson, null, 2))
            } catch (e) {
                setLeftErr(`格式错误：${e}`)
            }
        }
        if (rightValue.trim() !== "") {
            try {
                const rightJson = JSON.parse(rightValue)
                setRightValue(JSON.stringify(rightJson, null, 2))
            } catch (e) {
                setRightErr(`格式错误：${e}`)
            }
        }
    }

    return <div>
        <Row style={{marginTop: '68px', marginBottom: "5px"}}>
            <Col span={24}>
                <Space>
                <Button onClick={onBeautify}>美化</Button>
                    {isEdit && <Button type="primary" onClick={() => setEdit(false)}>比较</Button>}
                    {!isEdit &&<Button type="primary" onClick={() => setEdit(true)}>编辑</Button>}
                </Space>
            </Col>
        </Row>
        {isEdit && <Row >
            <Col span={12}>
                {leftErr && <div>{leftErr}</div>}
                <TextArea value={leftValue}  style={{ height: winHeight }} onChange={e => setLeftValue(e.target.value)}/>
            </Col>
            <Col span={12}>
                {rightErr && <div>{rightErr}</div>}
                <TextArea value={rightValue}   style={{ height: winHeight }} onChange={e => setRightValue(e.target.value)}/>
            </Col>
        </Row>}

        {!isEdit && <Row >
            <Col span={24}>
                <ReactDiffViewer
                    oldValue={leftValue}
                    newValue={rightValue}
                    splitView={false}
                />
            </Col>
        </Row>}

    </div>
}

export default Comparator
