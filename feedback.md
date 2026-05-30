human approve 的实现完全不对，应该直接在`if (nextStep.state === 'COMPLETED' || nextStep.state === 'WAIT_HUMAN_APPROVE') {` 
break，不需要一直 while await 这种代码，并且用户确认了，这个还是直接使用当前的这个workflow继续 执行 agent loop逻辑（就是那个状态机逻辑），
需要思考持久化怎么实现

